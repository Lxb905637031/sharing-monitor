import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { doubleRAF } from './lib/doubleRAF.js'
import { getActivationStart } from './lib/getActivationStart.js'
import { getVisibilityWatcher } from './lib/getVisibilityWatcher.js'
import { initMetric } from './lib/initMetric.js'
import { observe } from './lib/observe.js'
import { onHidden } from './lib/onHidden.js'
import { runOnce } from './lib/runOnce.js'
import { whenActivated } from './lib/whenActivated.js'
import { whenIdle } from './lib/whenIdle.js'
import { LCPMetric, MetricRatingThresholds, ReportOpts } from './types.js'

/**
 * LCP（最大内容绘制）指标的评级阈值（Core Web Vitals 标准）
 * 核心规则（参考：https://web.dev/articles/lcp#what_is_a_good_lcp_score）：
 * - ≤2500ms（2.5秒）→ good（良好）
 * - 2500ms < 值 ≤4000ms（4秒）→ needs-improvement（待改进）
 * - >4000ms（4秒）→ poor（较差）
 */
export const LCPThresholds: MetricRatingThresholds = [2500, 4000]

/**
 * 已上报的LCP指标ID映射表（全局单例）
 * 作用：避免同一LCP指标实例被重复上报（如页面隐藏+用户输入双重触发stopListening）
 */
const reportedMetricIDs: Record<string, boolean> = {}

/**
 * 监听并上报LCP（最大内容绘制）指标的核心函数
 * LCP定义：页面加载过程中，首次绘制「最大可见内容元素」的时间，反映页面核心内容加载速度
 * 核心设计：
 * 1. 监听`largest-contentful-paint`条目，捕获最大内容元素的渲染时间；
 * 2. 排除页面隐藏前未完成的LCP（无用户体验意义）；
 * 3. 用户交互后停止监听（LCP仅关注加载阶段的最大内容，交互后变化不计入）；
 * 4. 兼容预渲染、BFCache恢复等边界场景。
 * @param {(metric: LCPMetric) => void} onReport - 指标上报回调（接收最终的LCP指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化）
 */
export const onLCP = (onReport: (metric: LCPMetric) => void, opts?: ReportOpts) => {
    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 1. 等待页面激活（预渲染页面需激活后才计算LCP，避免预渲染阶段的无效数据）
    whenActivated(() => {
        // 2. 获取页面可见性监控器（用于判定LCP是否发生在页面首次隐藏前）
        const visibilityWatcher = getVisibilityWatcher()
        // 3. 初始化LCP指标对象（name固定为'LCP'，初始值-1）
        let metric = initMetric('LCP')
        // 4. 声明上报函数（后续由bindReporter初始化）
        let report: ReturnType<typeof bindReporter>

        /**
         * 处理largest-contentful-paint类型性能条目（核心：计算LCP值）
         * @param {LCPMetric['entries']} entries - LCP相关的性能条目数组
         */
        const handleEntries = (entries: LCPMetric['entries']) => {
            // 配置项判定：若不上报所有变化，仅保留最后一条（最新的最大内容绘制条目）
            // 原因：LCP可能多次更新（如先加载小图，后加载大图替换为最大内容），最终值以最后一条为准
            if (!opts!.reportAllChanges) {
                entries = entries.slice(-1) // 截取数组最后一个元素
            }

            entries.forEach(entry => {
                // 关键判定：LCP发生在页面首次隐藏前（排除隐藏后渲染的无效LCP）
                if (entry.startTime < visibilityWatcher.firstHiddenTime) {
                    // 计算LCP值（Core Web Vitals 标准逻辑）：
                    // entry.startTime：LCP原生时间（优先取renderTime，无则取loadTime）
                    // getActivationStart()：预渲染页面的激活时间
                    // 逻辑：LCP = 原生时间 - 激活时间，最小值为0（避免预渲染场景下出现负值）
                    metric.value = Math.max(entry.startTime - getActivationStart(), 0)
                    // 记录当前最大内容对应的条目（用于归因，如元素标签、大小等）
                    metric.entries = [entry]
                    // 触发上报（非强制，由bindReporter控制是否上报）
                    report()
                }
            })
        }

        // 5. 监听largest-contentful-paint类型性能条目（核心：捕获LCP数据）
        const po = observe('largest-contentful-paint', handleEntries)

        // 6. 仅当观察器创建成功时，初始化上报逻辑+处理边界场景
        if (po) {
            // 初始化上报函数：绑定回调、指标、阈值、配置项
            report = bindReporter(onReport, metric, LCPThresholds, opts!.reportAllChanges)

            /**
             * 停止LCP监听并强制上报最终值（仅执行一次）
             * 作用：避免用户交互后LCP继续更新，保证指标仅反映「加载阶段」的最大内容绘制
             */
            const stopListening = runOnce(() => {
                // 避免重复上报（通过metric.id判定，同一指标实例仅上报一次）
                if (!reportedMetricIDs[metric.id]) {
                    // 提取观察器中未处理的LCP条目，补充计算
                    handleEntries(po!.takeRecords() as LCPMetric['entries'])
                    // 断开观察器（停止监听后续LCP变化）
                    po!.disconnect()
                    // 标记该指标已上报，避免重复
                    reportedMetricIDs[metric.id] = true
                    // 强制触发最终上报（确保LCP值被记录）
                    report(true)
                }
            })

            // 7. 用户交互后停止监听（LCP核心规则：仅关注加载阶段，交互后不计入）
            // 监听键盘按下（keydown）和点击（click）事件（覆盖大部分用户主动交互）
            ;['keydown', 'click'].forEach(type => {
                // 绑定事件（捕获阶段触发，优先级更高）
                // 用whenIdle包装：避免阻塞交互事件处理，降低对INP的影响
                addEventListener(type, () => whenIdle(stopListening), true)
            })

            // 8. 页面隐藏时兜底处理（避免LCP数据丢失）
            onHidden(stopListening)

            // 9. 监听BFCache（后退/前进缓存）恢复事件（兼容缓存恢复场景）
            onBFCacheRestore(event => {
                // 重新初始化LCP指标（BFCache恢复视为新的导航周期）
                metric = initMetric('LCP')
                // 重新初始化上报函数
                report = bindReporter(onReport, metric, LCPThresholds, opts!.reportAllChanges)

                // 双RAF延迟计算LCP值（保证缓存恢复后渲染流程完成）
                doubleRAF(() => {
                    // BFCache恢复场景下，LCP值 = 当前时间 - 缓存恢复时间
                    metric.value = performance.now() - event.timeStamp
                    // 标记该指标已上报
                    reportedMetricIDs[metric.id] = true
                    // 强制上报BFCache恢复后的LCP值
                    report(true)
                })
            })
        }
    })
}
