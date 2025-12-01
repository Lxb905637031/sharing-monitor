import { getInteractionCount } from './polyfills/interactionCountPolyfill.js'

/**
 * 交互数据结构：存储单条交互的核心信息（用于INP指标计算）
 */
interface Interaction {
    // 交互唯一ID（对应PerformanceEventTiming.interactionId）
    id: number
    // 交互延迟（即INP核心指标：从用户交互到下一帧绘制的耗时，此处暂用entry.duration替代）
    latency: number
    // 关联的性能条目数组（同一交互可能包含多个PerformanceEventTiming条目）
    entries: PerformanceEventTiming[]
}

/**
 * 条目预处理钩子函数类型：处理每个PerformanceEventTiming条目前执行的回调
 */
interface EntryPreProcessingHook {
    (entry: PerformanceEventTiming): void
}

/**
 * 页面中最长交互列表（按latency降序排列，最长的排在首位）
 * 列表长度最多为MAX_INTERACTIONS_TO_CONSIDER（10），避免内存占用过高
 */
export const longestInteractionList: Interaction[] = []

/**
 * 最长交互的ID映射表：通过interactionId快速查找对应的Interaction对象
 * 核心作用：避免遍历列表，提升交互条目合并的效率
 */
export const longestInteractionMap: Map<number, Interaction> = new Map()

/**
 * 库内监听`event`类型性能条目时默认的时长阈值（单位：毫秒）
 * 含义：仅监听耗时≥40ms的交互事件（过滤短耗时交互，聚焦影响体验的卡顿）
 */
export const DEFAULT_DURATION_THRESHOLD = 40

/**
 * BFCache（后退/前进缓存）恢复后的交互计数基准值
 * 作用：p98交互延迟计算仅考虑当前导航周期的交互，排除BFCache恢复前的历史交互
 */
let prevInteractionCount = 0

/**
 * 获取当前导航周期的交互总数（扣除BFCache恢复前的历史交互数）
 * @returns {number} 当前导航周期的交互数量
 */
const getInteractionCountForNavigation = () => {
    // 总交互数 - BFCache恢复时的基准数 = 当前导航的交互数
    return getInteractionCount() - prevInteractionCount
}

/**
 * 重置交互数据（用于BFCache恢复/页面导航切换时）
 * 核心：清空历史交互列表+映射表，重置交互计数基准
 */
export const resetInteractions = () => {
    // 更新基准数为当前总交互数
    prevInteractionCount = getInteractionCount()
    // 清空最长交互列表
    longestInteractionList.length = 0
    // 清空交互ID映射表
    longestInteractionMap.clear()
}

/**
 * 估算当前页面的p98最长交互（INP指标核心逻辑：取p98分位数的交互作为INP候选）
 * p98含义：98%的交互延迟都低于该值，剩余2%的最长交互中取该位置的交互
 * @returns {Interaction | undefined} p98分位数对应的最长交互（INP候选）
 */
export const estimateP98LongestInteraction = () => {
    // 计算p98对应的索引：
    // 1. getInteractionCountForNavigation()/50 → 近似p98分位数（1/50≈2%）
    // 2. Math.min确保索引不超过列表长度-1（避免越界）
    const candidateInteractionIndex = Math.min(longestInteractionList.length - 1, Math.floor(getInteractionCountForNavigation() / 50))

    // 返回p98位置的交互（即INP指标的最终候选）
    return longestInteractionList[candidateInteractionIndex]
}

/**
 * 最长交互列表的最大长度限制（仅保留前10条最长交互）
 * 目的：防止页面交互过多时，列表占用内存过高
 */
const MAX_INTERACTIONS_TO_CONSIDER = 10

/**
 * 条目预处理回调列表：每个交互条目处理前执行的钩子函数
 * 扩展用途：允许归因模块在条目处理前注入自定义逻辑（如补充元素信息、过滤无效条目）
 */
export const entryPreProcessingCallbacks: EntryPreProcessingHook[] = []

/**
 * 处理单个交互性能条目，将其纳入最长交互列表（INP指标核心处理逻辑）
 * 核心逻辑：
 * 1. 过滤无效条目 → 2. 判定是否为候选交互 → 3. 合并/创建交互对象 → 4. 排序并截断列表
 * @param {PerformanceEventTiming} entry - 待处理的交互性能条目
 */
export const processInteractionEntry = (entry: PerformanceEventTiming) => {
    // 1. 执行所有条目预处理回调（如归因信息补充）
    entryPreProcessingCallbacks.forEach(cb => cb(entry))

    // 2. 过滤非INP候选条目：
    // - 无interactionId且非first-input条目（first-input是FID/INP的核心候选）
    if (!(entry.interactionId || entry.entryType === 'first-input')) return

    // 3. 获取当前最长交互列表中最短的那条（列表最后一位）
    const minLongestInteraction = longestInteractionList[longestInteractionList.length - 1]

    // 4. 查找该条目所属的已有交互（通过interactionId快速匹配）
    const existingInteraction = longestInteractionMap.get(entry.interactionId!)

    // 5. 判定是否需要处理该条目：
    // - 已有交互（需合并更新）
    // - 列表未满10条（直接加入）
    // - 条目耗时超过列表中最短交互的latency（替换最短的）
    if (
        existingInteraction ||
        longestInteractionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
        entry.duration > (minLongestInteraction?.latency ?? 0)
    ) {
        // 6. 合并/创建交互对象：
        if (existingInteraction) {
            // 6.1 已有交互：更新latency和entries
            if (entry.duration > existingInteraction.latency) {
                // 新条目耗时更长 → 替换为当前条目（取最长耗时作为交互latency）
                existingInteraction.entries = [entry]
                existingInteraction.latency = entry.duration
            } else if (entry.duration === existingInteraction.latency && entry.startTime === existingInteraction.entries[0]?.startTime) {
                // 耗时相同且开始时间一致 → 追加条目（同一交互的多阶段数据）
                existingInteraction.entries.push(entry)
            }
        } else {
            // 6.2 新交互：创建并加入映射表+列表
            const interaction = {
                id: entry.interactionId!,
                latency: entry.duration,
                entries: [entry],
            }
            longestInteractionMap.set(interaction.id, interaction)
            longestInteractionList.push(interaction)
        }

        // 7. 排序并截断列表：
        // 7.1 按latency降序排序（最长的排在前面）
        longestInteractionList.sort((a, b) => b.latency - a.latency)
        // 7.2 超过10条时，截断并删除映射表中多余的交互
        if (longestInteractionList.length > MAX_INTERACTIONS_TO_CONSIDER) {
            // 截取超出部分的交互，逐个删除映射表中的记录
            longestInteractionList.splice(MAX_INTERACTIONS_TO_CONSIDER).forEach(i => longestInteractionMap.delete(i.id))
        }
    }
}
