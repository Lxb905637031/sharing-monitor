import type { CLSMetric, CLSMetricWithAttribution } from './cls.js'
import type { FCPMetric, FCPMetricWithAttribution } from './fcp.js'
import type { FIDMetric, FIDMetricWithAttribution } from './fid.js'
import type { INPMetric, INPMetricWithAttribution } from './inp.js'
import type { LCPMetric, LCPMetricWithAttribution } from './lcp.js'
import type { TTFBMetric, TTFBMetricWithAttribution } from './ttfb.js'

export interface Metric {
    /**
     * 指标名称（采用缩写形式）。
     */
    name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'

    /**
     * 指标的当前数值。
     */
    value: number

    /**
     * 指标评级，用于判定指标数值是否处于该指标的「良好」、「待改进」或「较差」阈值范围内。
     */
    rating: 'good' | 'needs-improvement' | 'poor'

    /**
     * 当前指标数值与上一次上报数值的差值。
     * 首次上报时，`delta` 和 `value` 的值始终相等。
     */
    delta: number

    /**
     * 代表该指标实例的唯一标识。此ID可被分析工具用于：
     * 1. 对同一指标实例上报的多个数值进行去重；
     * 2. 将多个差值分组汇总并计算总计值；
     * 3. 区分同一页面上报的多个不同指标实例（例如页面从后退/前进缓存恢复时，会创建新的指标对象）。
     */
    id: string

    /**
     * 与指标数值计算相关的所有性能条目。
     * 若指标数值未基于任何性能条目计算（例如无布局偏移时CLS值为0），该数组也可能为空。
     */
    entries: PerformanceEntry[]
    /**
     * 导航类型。
     *
     * 该值默认返回导航计时API（Navigation Timing API）的结果（若浏览器不支持该API则返回`undefined`），
     * 但存在以下例外情况：
     * - 'back-forward-cache'：页面从bfcache（后退/前进缓存）中恢复时；
     * - 'back_forward' 会重命名为 'back-forward' 以保证命名一致性；
     * - 'prerender'：页面为预渲染页面时；
     * - 'restore'：页面被浏览器丢弃后，由用户手动恢复时。
     */
    navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender' | 'restore'
}

export type MetricType = CLSMetric | LCPMetric | FCPMetric | FIDMetric | TTFBMetric | INPMetric

export type MetricWithAttribution =
    | CLSMetricWithAttribution
    | FCPMetricWithAttribution
    | FIDMetricWithAttribution
    | INPMetricWithAttribution
    | LCPMetricWithAttribution
    | TTFBMetricWithAttribution

export type MetricRatingThresholds = [number, number]

export interface ReportCallback {
    (metric: MetricType): void
}

export interface ReportOpts {
    reportAllChanges?: boolean
    durationThreshold?: number
}

/**
 * 文档的加载状态。注：该值与 `document.readyState` 类似，但会将「interactive（交互）」状态
 * 进一步细分为 DOMContentLoaded 事件触发前和触发后的两个阶段。
 *
 * 状态说明：
 * - `loading`：文档的初始响应内容尚未完全下载并解析完成。该状态与 `readyState` 的对应值含义一致。
 * - `dom-interactive`：文档已完全加载并解析完成，但脚本（可能）尚未全部加载并执行完毕。
 * - `dom-content-loaded`：文档已完全加载并解析完成，且所有脚本（`async` 脚本除外）均已加载并执行完毕。
 * - `complete`：文档及其所有子资源均已加载完成。该状态与 `readyState` 的对应值含义一致。
 */
export type LoadState = 'loading' | 'dom-interactive' | 'dom-content-loaded' | 'complete'
