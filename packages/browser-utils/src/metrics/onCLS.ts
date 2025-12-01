import { onBFCacheRestore } from './lib/bfcache.js'
import { bindReporter } from './lib/bindReporter.js'
import { doubleRAF } from './lib/doubleRAF.js'
import { initMetric } from './lib/initMetric.js'
import { observe } from './lib/observe.js'
import { onHidden } from './lib/onHidden.js'
import { runOnce } from './lib/runOnce.js'
import { onFCP } from './onFCP.js'
import { CLSMetric, MetricRatingThresholds, ReportOpts } from './types'

/**
 * CLS（累积布局偏移）指标的评级阈值（Core Web Vitals 标准）
 * 核心规则：
 * - ≤0.1 → good（良好）
 * - 0.1 < 值 ≤0.25 → needs-improvement（待改进）
 * - >0.25 → poor（较差）
 */
export const CLSThresholds: MetricRatingThresholds = [0.1, 0.25]

/**
 * 监听并上报CLS（累积布局偏移）指标的核心函数
 * CLS定义：页面生命周期内所有意外布局偏移的累积值，反映页面视觉稳定性
 * 核心设计：
 * 1. 基于FCP触发监听（FCP后才计算有效布局偏移）；
 * 2. 按会话合并布局偏移（5秒内、间隔1秒内的偏移合并为一个会话）；
 * 3. 兼容页面隐藏、BFCache恢复等边界场景。
 * @param {(metric: CLSMetric) => void} onReport - 指标上报回调（接收最终的CLS指标对象）
 * @param {ReportOpts} [opts] - 上报配置项（如是否上报所有变化）
 */
export const onCLS = (onReport: (metric: CLSMetric) => void, opts?: ReportOpts) => {
    // 兼容配置项：未传则设为空对象
    opts = opts || {}

    // 1. 依赖FCP触发CLS监听（FCP前的布局偏移无用户体验意义，避免无效计算）
    // runOnce保证CLS监听逻辑仅执行一次（即使FCP多次触发）
    onFCP(
        runOnce(() => {
            // 2. 初始化CLS指标对象（name固定为'CLS'，初始值0）
            let metric = initMetric('CLS', 0)
            // 3. 声明上报函数（后续由bindReporter初始化）
            let report: ReturnType<typeof bindReporter>

            // 4. 布局偏移会话变量：用于合并连续的布局偏移（CLS核心计算逻辑）
            // sessionValue：当前会话的布局偏移累积值
            let sessionValue = 0
            // sessionEntries：当前会话包含的布局偏移条目（用于归因）
            let sessionEntries: LayoutShift[] = []

            /**
             * 处理layout-shift类型性能条目（核心：按会话合并布局偏移）
             * CLS会话合并规则（Google官方标准）：
             * - 单个会话最长5秒；
             * - 会话内相邻偏移间隔不超过1秒；
             * - 排除用户主动输入（如点击、输入）导致的偏移（hadRecentInput=true）。
             * @param {LayoutShift[]} entries - layout-shift类型的性能条目数组
             */
            const handleEntries = (entries: LayoutShift[]) => {
                entries.forEach(entry => {
                    // 过滤用户主动输入导致的布局偏移（这类偏移是预期的，不计入CLS）
                    if (!entry.hadRecentInput) {
                        // 获取当前会话的第一条/最后一条条目
                        const firstSessionEntry = sessionEntries[0]
                        const lastSessionEntry = sessionEntries[sessionEntries.length - 1]

                        // 判定是否合并到当前会话：
                        if (
                            sessionValue > 0 && // 已有会话（非首次偏移）
                            entry.startTime - (lastSessionEntry?.startTime ?? 0) < 1000 && // 与最后一条偏移间隔<1秒
                            entry.startTime - (firstSessionEntry?.startTime ?? 0) < 5000 // 会话总时长<5秒
                        ) {
                            // 合并到当前会话：累加偏移值，追加条目
                            sessionValue += entry.value
                            sessionEntries.push(entry)
                        } else {
                            // 新建会话：重置会话值和条目数组
                            sessionValue = entry.value
                            sessionEntries = [entry]
                        }
                    }
                })

                // 更新CLS指标：仅当当前会话值大于已记录的最大值时，更新指标
                if (sessionValue > metric.value) {
                    metric.value = sessionValue // CLS取所有会话的最大值（官方标准）
                    metric.entries = sessionEntries // 记录最大值对应的会话条目
                    report() // 触发上报（非强制，由bindReporter控制是否上报）
                }
            }

            // 5. 监听layout-shift类型性能条目（核心：捕获所有布局偏移）
            const po = observe('layout-shift', handleEntries)

            // 6. 仅当观察器创建成功时，初始化上报逻辑+处理边界场景
            if (po) {
                // 初始化上报函数：绑定回调、指标、阈值、配置项
                report = bindReporter(onReport, metric, CLSThresholds, opts!.reportAllChanges)

                // 7. 页面隐藏时兜底处理（避免布局偏移数据丢失）
                onHidden(() => {
                    // 提取观察器中未处理的布局偏移条目，补充计算
                    handleEntries(po.takeRecords() as CLSMetric['entries'])
                    // 强制触发上报（保证页面隐藏前CLS数据被上报）
                    report(true)
                })

                // 8. 监听BFCache（后退/前进缓存）恢复事件（兼容缓存恢复场景）
                onBFCacheRestore(() => {
                    // 重置会话变量（缓存恢复视为新的导航周期）
                    sessionValue = 0
                    // 重新初始化CLS指标
                    metric = initMetric('CLS', 0)
                    // 重新初始化上报函数
                    report = bindReporter(onReport, metric, CLSThresholds, opts!.reportAllChanges)

                    // 双RAF延迟上报（保证缓存恢复后数据就绪）
                    doubleRAF(() => report())
                })

                // 9. 立即触发一次上报（setTimeout 0推入微任务队列）
                // 目的：保证初始状态的CLS值（0）被上报，避免无布局偏移时数据缺失
                setTimeout(report, 0)
            }
        })
    )
}
