import type { Metric } from './base.js'

/**
 * 专用于LCP（最大内容绘制）的Metric指标对象（继承基础Metric接口，限定LCP专属字段）。
 * LCP：Largest Contentful Paint，Core Web Vitals核心指标，衡量页面可视区域内最大内容元素的渲染时间。
 */
export interface LCPMetric extends Metric {
    name: 'LCP' // 固定为LCP，限定该指标为最大内容绘制指标
    entries: LargestContentfulPaint[] // 关联的性能条目：仅包含最大内容绘制相关的LargestContentfulPaint类型
}

/**
 * 包含LCP辅助调试信息的对象，可随当前页面访问的LCP数值一同上报，
 * 用于定位真实用户场景中（生产环境）出现的LCP相关性能问题。
 */
export interface LCPAttribution {
    /**
     * 对应页面最大内容绘制（LCP）的元素标识（通常为元素选择器）。
     */
    element?: string
    /**
     * LCP图片资源的URL（若适用）。若LCP元素为文本节点，则该值未定义。
     */
    url?: string
    /**
     * 从用户触发页面加载开始，到浏览器接收到响应首个字节的耗时（即TTFB，首字节时间）。
     * 详见【优化LCP】文档：https://web.dev/articles/optimize-lcp
     */
    timeToFirstByte: number
    /**
     * TTFB（首字节时间）与浏览器开始加载LCP资源的时间差（若存在LCP资源则为实际差值，否则为0）。
     * 详见【优化LCP】文档：https://web.dev/articles/optimize-lcp
     */
    resourceLoadDelay: number
    /**
     * LCP资源本身的总加载耗时（若存在LCP资源则为实际耗时，否则为0）。
     * 详见【优化LCP】文档：https://web.dev/articles/optimize-lcp
     */
    resourceLoadDuration: number
    /**
     * LCP资源加载完成，到LCP元素完全渲染的时间差。
     * 详见【优化LCP】文档：https://web.dev/articles/optimize-lcp
     */
    elementRenderDelay: number
    /**
     * 当前页面的navigation（导航）性能条目，可用于排查通用的页面加载问题。
     * 例如：可通过该条目访问`serverTiming`服务端计时信息：navigationEntry?.serverTiming。
     */
    navigationEntry?: PerformanceNavigationTiming
    /**
     * LCP资源对应的resource（资源）性能条目（若适用），可用于排查资源加载相关问题。
     */
    lcpResourceEntry?: PerformanceResourceTiming
    /**
     * 与LCP对应的LargestContentfulPaint性能条目（包含LCP的精准触发时间、元素信息等）。
     */
    lcpEntry?: LargestContentfulPaint
}

/**
 * 带归因信息的LCP专属Metric对象（继承基础LCPMetric，扩展LCP问题归因数据）。
 */
export interface LCPMetricWithAttribution extends LCPMetric {
    attribution: LCPAttribution
}
