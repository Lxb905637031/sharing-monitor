import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { getVisibilityWatcher } from './lib/getVisibilityWatcher.js'
import { initMetric } from './lib/initMetric.js'
import { observe } from './lib/observe.js'
import { onHidden } from './lib/onHidden.js'
import { firstInputPolyfill, resetFirstInputPolyfill } from './lib/polyfills/firstInputPolyfill.js'
import { runOnce } from './lib/runOnce.js'
import { whenActivated } from './lib/whenActivated.js'
import { FIDMetric, FirstInputPolyfillCallback, MetricRatingThresholds, ReportOpts } from './types.js'

/**
 * FID（首次输入延迟）指标的评级阈值（Core Web Vitals 标准）
 * 核心规则：
 * - ≤100ms → good（良好）
 * - 100ms < 值 ≤300ms → needs-improvement（待改进）
 * - >300ms → poor（较差）
 * FID 已被 INP 替代，但仍是部分场景的兼容指标，反映首次用户交互的响应速度
 */
export const FIDThresholds: MetricRatingThresholds = [100, 300]

/**
 * 监听并上报FID（首次输入延迟）指标的核心函数
 * FID定义：用户首次与页面交互（点击、输入等）到浏览器开始处理该交互的时间差
 * 核心设计：
 * 1. 兼容原生API与polyfill（低版本浏览器支持）；
 * 2. 过滤页面隐藏后的无效交互；
 * 3. 适配BFCache恢复、页面隐藏等边界场景。
 * @param {(metric: FIDMetric) => void} onReport - 指标上报回调（接收最终的FID指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化）
 */
export const onFID = (onReport: (metric: FIDMetric) => void, opts?: ReportOpts) => {
    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 1. 等待页面激活（预渲染页面需激活后才计算FID，避免预渲染阶段的无效交互）
    whenActivated(() => {
        // 2. 获取页面可见性监控器（用于判定交互是否发生在页面首次隐藏前）
        const visibilityWatcher = getVisibilityWatcher()
        // 3. 初始化FID指标对象（name固定为'FID'，初始值-1）
        let metric = initMetric('FID')
        // 4. 声明上报函数（后续由bindReporter初始化）
        let report: ReturnType<typeof bindReporter>

        /**
         * 处理单个首次输入条目（核心：计算FID值）
         * @param {PerformanceEventTiming} entry - 首次输入性能条目
         */
        const handleEntry = (entry: PerformanceEventTiming) => {
            // 关键判定：交互发生在页面首次隐藏前（排除隐藏后用户触发的无效交互）
            if (entry.startTime < visibilityWatcher.firstHiddenTime) {
                // 计算FID值：处理开始时间 - 交互开始时间（反映浏览器响应延迟）
                // entry.startTime：用户交互发生的时间
                // entry.processingStart：浏览器开始处理该交互的时间
                metric.value = entry.processingStart - entry.startTime
                // 将首次输入条目加入指标对象（用于归因）
                metric.entries.push(entry)
                // 强制触发上报（FID仅触发一次，无需重复计算）
                report(true)
            }
        }

        /**
         * 处理首次输入条目数组（适配observe的回调格式）
         * @param {FIDMetric['entries']} entries - 首次输入性能条目数组
         */
        const handleEntries = (entries: FIDMetric['entries']) => {
            entries.forEach(handleEntry)
        }

        // 5. 监听'first-input'类型性能条目（现代浏览器原生支持）
        const po = observe('first-input', handleEntries)

        // 6. 初始化上报函数（无论观察器是否创建成功，均绑定上报逻辑）
        report = bindReporter(onReport, metric, FIDThresholds, opts!.reportAllChanges)

        // 7. 仅当观察器创建成功时，处理边界场景（页面隐藏+BFCache恢复）
        if (po) {
            // 7.1 页面隐藏时兜底处理（避免首次输入条目未被捕获）
            onHidden(
                runOnce(() => {
                    // 提取观察器中未处理的首次输入条目，补充计算
                    handleEntries(po.takeRecords() as FIDMetric['entries'])
                    // 断开观察器（页面隐藏后无需继续监听）
                    po.disconnect()
                })
            )

            // 7.2 监听BFCache（后退/前进缓存）恢复事件（兼容缓存恢复场景）
            onBFCacheRestore(() => {
                // 重新初始化FID指标（BFCache恢复视为新的导航周期）
                metric = initMetric('FID')
                // 重新初始化上报函数
                report = bindReporter(onReport, metric, FIDThresholds, opts!.reportAllChanges)

                // 重置first-input polyfill（避免缓存恢复后重复触发）
                resetFirstInputPolyfill()
                // 重新启用polyfill（兼容低版本浏览器，捕获首次输入）
                firstInputPolyfill(handleEntry as FirstInputPolyfillCallback)
            })
        }

        // 8. 启用first-input polyfill（兼容不支持'first-input'类型的低版本浏览器）
        firstInputPolyfill(handleEntry as FirstInputPolyfillCallback)
    })
}
