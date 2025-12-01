import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { initMetric } from './lib/initMetric.js'
import {
    DEFAULT_DURATION_THRESHOLD, // 默认交互时长阈值（40ms）
    estimateP98LongestInteraction, // 估算p98分位数的最长交互（INP核心）
    processInteractionEntry, // 处理单个交互条目（合并/筛选最长交互）
    resetInteractions, // 重置交互数据（BFCache恢复时用）
} from './lib/interactions.js'
import { observe } from './lib/observe.js'
import { onHidden } from './lib/onHidden.js'
import { initInteractionCountPolyfill } from './lib/polyfills/interactionCountPolyfill.js'
import { whenActivated } from './lib/whenActivated.js'
import { whenIdle } from './lib/whenIdle.js'
import { INPMetric, MetricRatingThresholds, ReportOpts } from './types.js'

/**
 * INP（Interaction to Next Paint）指标的评级阈值（Core Web Vitals 标准）
 * 核心规则：
 * - ≤200ms → good（良好）
 * - 200ms < 值 ≤500ms → needs-improvement（待改进）
 * - >500ms → poor（较差）
 * INP是替代FID的核心交互性能指标，反映页面生命周期内用户交互的响应速度
 */
export const INPThresholds: MetricRatingThresholds = [200, 500]

/**
 * 监听并上报INP（Interaction to Next Paint）指标的核心函数
 * INP定义：页面生命周期内所有用户交互中，取p98分位数的「交互到下一帧绘制」延迟
 * 核心设计：
 * 1. 监听所有有效交互条目（event+first-input）；
 * 2. 后台空闲时处理交互数据，避免阻塞主线程；
 * 3. 基于p98分位数计算最终INP值；
 * 4. 兼容BFCache恢复、页面隐藏等边界场景。
 * @param {(metric: INPMetric) => void} onReport - 指标上报回调（接收最终的INP指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化、自定义交互时长阈值）
 */
export const onINP = (onReport: (metric: INPMetric) => void, opts?: ReportOpts) => {
    // 1. 兼容性前置校验：浏览器需支持PerformanceEventTiming且包含interactionId属性
    // 不满足则直接返回，避免后续代码报错（INP依赖该API实现）
    if (!('PerformanceEventTiming' in self && 'interactionId' in PerformanceEventTiming.prototype)) {
        return
    }

    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 2. 等待页面激活（预渲染页面需激活后才计算INP，避免预渲染阶段的无效交互）
    whenActivated(() => {
        // 3. 初始化交互计数polyfill（兼容低版本浏览器获取交互总数）
        initInteractionCountPolyfill()

        // 4. 初始化INP指标对象（name固定为'INP'，初始值-1）
        let metric = initMetric('INP')
        // 5. 声明上报函数（后续由bindReporter初始化）
        let report: ReturnType<typeof bindReporter>

        /**
         * 处理交互条目数组（核心：后台计算INP值）
         * @param {INPMetric['entries']} entries - event/first-input类型的交互条目数组
         */
        const handleEntries = (entries: INPMetric['entries']) => {
            // 6. 空闲时处理交互数据（whenIdle：浏览器空闲+页面隐藏兜底，避免阻塞主线程）
            whenIdle(() => {
                // 6.1 逐个处理交互条目：合并同一交互的条目、筛选最长交互（存入longestInteractionList）
                entries.forEach(processInteractionEntry)

                // 6.2 估算p98分位数的最长交互（INP核心逻辑）
                const inp = estimateP98LongestInteraction()

                // 6.3 仅当INP值变化时，更新指标并上报（避免重复上报相同值）
                if (inp && inp.latency !== metric.value) {
                    metric.value = inp.latency // 更新INP值为p98分位数的交互延迟
                    metric.entries = inp.entries // 记录该交互对应的所有条目（用于归因）
                    report() // 触发上报（由bindReporter控制是否上报）
                }
            })
        }

        // 7. 监听'event'类型性能条目（核心：捕获大部分用户交互，如点击、输入、触摸）
        // 配置项：时长阈值（默认40ms，仅监听耗时≥阈值的交互，过滤短耗时无效交互）
        const po = observe('event', handleEntries, {
            durationThreshold: opts!.durationThreshold ?? DEFAULT_DURATION_THRESHOLD,
        })

        // 8. 初始化上报函数：绑定回调、指标、阈值、配置项
        report = bindReporter(onReport, metric, INPThresholds, opts!.reportAllChanges)

        // 9. 仅当观察器创建成功时，处理补充监听+边界场景
        if (po) {
            // 9.1 补充监听'first-input'类型条目（兼容首次输入交互，避免遗漏FID场景的交互）
            // buffered: true → 捕获调用observe前已产生的first-input条目
            po.observe({ type: 'first-input', buffered: true })

            // 9.2 页面隐藏时兜底处理（避免交互数据丢失）
            onHidden(() => {
                // 提取观察器中未处理的交互条目，补充计算
                handleEntries(po.takeRecords() as INPMetric['entries'])
                // 强制触发上报（保证页面隐藏前INP最终值被上报）
                report(true)
            })

            // 9.3 监听BFCache（后退/前进缓存）恢复事件（兼容缓存恢复场景）
            onBFCacheRestore(() => {
                // 重置交互数据（缓存恢复视为新的导航周期，清空历史最长交互列表）
                resetInteractions()
                // 重新初始化INP指标
                metric = initMetric('INP')
                // 重新初始化上报函数
                report = bindReporter(onReport, metric, INPThresholds, opts!.reportAllChanges)
            })
        }
    })
}
