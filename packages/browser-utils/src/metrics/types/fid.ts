import type { LoadState, Metric } from './base.js'

/**
 * 专用于FID（首次输入延迟）的Metric指标对象（继承基础Metric接口，限定FID专属字段）。
 */
export interface FIDMetric extends Metric {
    name: 'FID' // 固定为FID，限定该指标为首次输入延迟指标
    entries: PerformanceEventTiming[] // 关联的性能条目：仅包含事件计时相关的PerformanceEventTiming类型
}

/**
 * 包含FID辅助调试信息的对象，可随当前页面访问的FID数值一同上报，
 * 用于定位真实用户场景中（生产环境）出现的FID相关性能问题。
 */
export interface FIDAttribution {
    /**
     * 标识用户交互的目标元素选择器。该元素即为触发交互事件的`event.target`。
     */
    eventTarget: string
    /**
     * 用户触发交互的时间戳。该时间与触发事件的`event.timeStamp`值完全一致。
     */
    eventTime: number
    /**
     * 用户交互触发的事件类型（如click、keydown、touchstart等）。
     */
    eventType: string
    /**
     * 与FID对应的PerformanceEventTiming性能条目（包含FID的精准计时信息）。
     */
    eventEntry: PerformanceEventTiming
    /**
     * 首次用户交互发生时文档所处的加载状态（详见LoadState类型说明）。
     * 若首次交互发生在文档加载并执行脚本的阶段（通常为`dom-interactive`阶段），
     * 可能会导致较长的输入延迟。
     */
    loadState: LoadState
}

/**
 * 带归因信息的FID专属Metric对象（继承基础FIDMetric，扩展FID问题归因数据）。
 */
export interface FIDMetricWithAttribution extends FIDMetric {
    attribution: FIDAttribution
}
