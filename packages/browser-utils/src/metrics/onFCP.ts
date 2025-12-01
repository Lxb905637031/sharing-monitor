import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { doubleRAF } from './lib/doubleRAF.js'
import { getActivationStart } from './lib/getActivationStart.js'
import { getVisibilityWatcher } from './lib/getVisibilityWatcher.js'
import { initMetric } from './lib/initMetric.js'
import { observe } from './lib/observe.js'
import { whenActivated } from './lib/whenActivated.js'
import { FCPMetric, MetricRatingThresholds, ReportOpts } from './types'

/**
 * FCP（首次内容绘制）指标的评级阈值（单位：毫秒）
 * 核心规则（Core Web Vitals 标准）：
 * - ≤1800ms → good（良好）
 * - 1800ms < 值 ≤3000ms → needs-improvement（待改进）
 * - >3000ms → poor（较差）
 */
export const FCPThresholds: MetricRatingThresholds = [1800, 3000]

/**
 * 监听并上报FCP（首次内容绘制）指标的核心函数
 * FCP定义：页面首次绘制文本、图像、SVG等内容的时间，反映页面核心内容的首次渲染速度
 * @param {(metric: FCPMetric) => void} onReport - 指标上报回调（接收最终的FCP指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化）
 */
export const onFCP = (onReport: (metric: FCPMetric) => void, opts?: ReportOpts) => {
    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 1. 等待页面激活（预渲染页面需激活后才计算FCP，避免预渲染阶段的无效数据）
    whenActivated(() => {
        // 2. 获取页面可见性监控器（用于判定FCP是否发生在页面首次隐藏前）
        const visibilityWatcher = getVisibilityWatcher()
        // 3. 初始化FCP指标对象（name固定为'FCP'，初始值-1）
        let metric = initMetric('FCP')
        // 4. 声明上报函数（后续由bindReporter初始化）
        let report: ReturnType<typeof bindReporter>

        /**
         * 处理paint类型性能条目（核心：筛选FCP条目并计算值）
         * @param {FCPMetric['entries']} entries - paint类型的性能条目数组
         */
        const handleEntries = (entries: FCPMetric['entries']) => {
            entries.forEach(entry => {
                // 筛选出「首次内容绘制」条目（排除first-paint等其他paint条目）
                if (entry.name === 'first-contentful-paint') {
                    // 找到FCP条目后，立即断开性能观察器（避免重复监听）
                    po!.disconnect()

                    // 关键判定：FCP发生在页面首次隐藏前（排除隐藏后渲染的无效FCP）
                    if (entry.startTime < visibilityWatcher.firstHiddenTime) {
                        // 计算FCP值：
                        // entry.startTime（FCP原生时间） - getActivationStart()（预渲染激活时间）
                        // 取最大值0，避免预渲染场景下出现负值
                        metric.value = Math.max(entry.startTime - getActivationStart(), 0)
                        // 将FCP条目加入指标对象的entries数组（用于归因）
                        metric.entries.push(entry)
                        // 强制触发上报（true表示forceReport）
                        report(true)
                    }
                }
            })
        }

        // 5. 监听paint类型性能条目（核心：捕获FCP条目）
        const po = observe('paint', handleEntries)

        // 6. 仅当观察器创建成功时，初始化上报逻辑+处理BFCache恢复场景
        if (po) {
            // 初始化上报函数：绑定回调、指标、阈值、配置项
            report = bindReporter(onReport, metric, FCPThresholds, opts!.reportAllChanges)

            // 7. 监听BFCache（后退/前进缓存）恢复事件（兼容页面从缓存恢复的场景）
            onBFCacheRestore(event => {
                // 7.1 重新初始化FCP指标（BFCache恢复视为新的导航周期）
                metric = initMetric('FCP')
                // 7.2 重新初始化上报函数（reportAllChanges取反，避免重复上报）
                report = bindReporter(onReport, metric, FCPThresholds, opts?.reportAllChanges)

                // 7.3 双RAF延迟计算FCP值（保证数据就绪）
                doubleRAF(() => {
                    // BFCache恢复场景下，FCP值 = 当前时间 - 缓存恢复时间
                    metric.value = performance.now() - event.timeStamp
                    // 强制上报BFCache恢复后的FCP值
                    report(true)
                })
            })
        }
    })
}
