import type { Metric } from './base.js'

/**
 * 专用于TTFB（首字节时间）的Metric指标对象（继承基础Metric接口，限定TTFB专属字段）。
 * TTFB：Time To First Byte，核心性能指标，衡量从用户发起请求到浏览器接收到服务端首个响应字节的耗时。
 */
export interface TTFBMetric extends Metric {
    name: 'TTFB' // 固定为TTFB，限定该指标为首字节时间指标
    entries: PerformanceNavigationTiming[] // 关联的性能条目：仅包含导航计时相关的PerformanceNavigationTiming类型
}

/**
 * 包含TTFB辅助调试信息的对象，可随当前页面访问的TTFB数值一同上报，
 * 用于定位真实用户场景中（生产环境）出现的TTFB相关性能问题。
 *
 * 注：这些数值主要对「非Service Worker处理的页面加载」有效；
 * 当页面加载涉及Service Worker时，不同浏览器的上报数据存在差异，详见：https://github.com/w3c/navigation-timing/issues/199
 */
export interface TTFBAttribution {
    /**
     * 从用户触发页面加载，到页面开始处理请求的总耗时。
     * 该值偏大通常是由于HTTP重定向导致，不过浏览器的其他处理流程也会计入该耗时（因此即使无重定向，该值通常也不为0）。
     */
    waitingDuration: number
    /**
     * 检查HTTP缓存是否命中的总耗时。
     * 对于Service Worker处理的导航请求，该耗时通常包含Service Worker启动时间、以及处理`fetch`事件监听器的时间（存在部分例外，详见上述链接）。
     */
    cacheDuration: number
    /**
     * 解析目标域名DNS（域名系统）的总耗时。
     */
    dnsDuration: number
    /**
     * 建立与目标域名网络连接的总耗时（包含TCP握手、TLS握手等）。
     */
    connectionDuration: number
    /**
     * 从请求发送完成，到接收到响应首个字节的总耗时。
     * 该时间包含网络传输耗时，以及服务端处理请求的耗时。
     */
    requestDuration: number
    /**
     * 当前页面的navigation（导航）性能条目，可用于排查通用的页面加载问题。
     * 例如：可通过该条目访问`serverTiming`服务端计时信息：navigationEntry?.serverTiming。
     */
    navigationEntry?: PerformanceNavigationTiming
}

/**
 * 带归因信息的TTFB专属Metric对象（继承基础TTFBMetric，扩展TTFB问题归因数据）。
 */
export interface TTFBMetricWithAttribution extends TTFBMetric {
    attribution: TTFBAttribution
}
