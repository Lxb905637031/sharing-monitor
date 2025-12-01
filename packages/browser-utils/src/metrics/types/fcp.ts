import type { LoadState, Metric } from './base.js'

/**
 * 专用于FCP（首次内容绘制）的Metric指标对象（继承基础Metric接口，限定FCP专属字段）。
 */
export interface FCPMetric extends Metric {
    name: 'FCP' // 固定为FCP，限定该指标为首次内容绘制指标
    entries: PerformancePaintTiming[] // 关联的性能条目：仅包含绘制相关的PerformancePaintTiming类型
}

/**
 * 包含FCP辅助调试信息的对象，可随当前页面访问的FCP数值一同上报，
 * 用于定位真实用户场景中（生产环境）出现的FCP相关性能问题。
 */
export interface FCPAttribution {
    /**
     * 从用户触发页面加载开始，到浏览器接收到响应首个字节的耗时（即TTFB，首字节时间）。
     */
    timeToFirstByte: number
    /**
     * TTFB（首字节时间）与FCP（首次内容绘制）之间的时间差。
     */
    firstByteToFCP: number
    /**
     * FCP发生时文档所处的加载状态（详见LoadState类型说明）。
     * 理想情况下，文档应在加载完成前完成绘制（例如处于`loading`或`dom-interactive`阶段）。
     */
    loadState: LoadState
    /**
     * 与FCP对应的PerformancePaintTiming性能条目（包含FCP的精准触发时间等信息）。
     */
    fcpEntry?: PerformancePaintTiming
    /**
     * 当前页面的navigation（导航）性能条目，可用于排查通用的页面加载问题。
     * 例如：可通过该条目访问`serverTiming`服务端计时信息：navigationEntry?.serverTiming。
     */
    navigationEntry?: PerformanceNavigationTiming
}

/**
 * 带归因信息的FCP专属Metric对象（继承基础FCPMetric，扩展FCP问题归因数据）。
 */
export interface FCPMetricWithAttribution extends FCPMetric {
    attribution: FCPAttribution
}
