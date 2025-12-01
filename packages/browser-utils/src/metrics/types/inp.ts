import type { LoadState, Metric } from './base.js'

/**
 * 专用于INP（交互延迟指标）的Metric指标对象（继承基础Metric接口，限定INP专属字段）。
 * INP：Interaction to Next Paint，替代FID的新一代交互性能核心指标，衡量所有用户交互的整体响应延迟。
 */
export interface INPMetric extends Metric {
    name: 'INP' // 固定为INP，限定该指标为交互延迟指标
    entries: PerformanceEventTiming[] // 关联的性能条目：仅包含事件计时相关的PerformanceEventTiming类型
}

/**
 * 包含INP辅助调试信息的对象，可随当前页面访问的INP数值一同上报，
 * 用于定位真实用户场景中（生产环境）出现的INP相关性能问题。
 */
export interface INPAttribution {
    /**
     * 标识INP候选交互所在帧内，用户首次交互的目标元素选择器。
     * 若该值为空字符串，通常表示交互发生后该元素已从DOM中移除。
     */
    interactionTarget: string
    /**
     * 由`interactionTargetSelector`标识的HTML元素引用。
     * 注：出于归因排查目的，标识元素的选择器通常比元素本身更实用；
     * 但仍提供该元素引用，以便在需要时获取额外上下文信息。
     */
    interactionTargetElement: Node | undefined
    /**
     * INP候选交互所在帧内，用户首次触发交互的时间戳。
     * （若同一帧内发生多次交互，仅上报首次交互的时间）
     */
    interactionTime: DOMHighResTimeStamp
    /**
     * 交互发生后下一帧绘制的最佳预估时间戳。
     * 通常该时间戳等于事件计时条目的`startTime + duration`，但由于`duration`值会四舍五入到最接近的8ms，
     * 可能出现“绘制发生在处理结束前”的假象（实际不可能发生）。
     * 该值会修正绘制时间，确保其始终晚于：
     * 1. 事件计时API的`processingEnd`（事件处理结束时间）；
     * 2. 长动画帧API的`renderStart`（渲染开始时间，若浏览器支持）；
     * 同时，该值会对同一动画帧内所有条目的duration取平均值，结果更接近“真实”绘制时间。
     */
    nextPaintTime: DOMHighResTimeStamp
    /**
     * 交互类型，基于对应事件条目的事件类型判定（即给定动画帧内首个包含`interactionId`的事件条目）：
     * - 对于"pointerdown"/"pointerup"/"click"事件，类型为"pointer"（指针交互）；
     * - 对于"keydown"/"keyup"事件，类型为"keyboard"（键盘交互）。
     */
    interactionType: 'pointer' | 'keyboard'
    /**
     * 与INP候选交互在同一动画帧内被处理的所有事件计时条目数组。
     */
    processedEventEntries: PerformanceEventTiming[]
    /**
     * 若浏览器支持长动画帧（Long Animation Frame）API：
     * 该数组包含所有与INP候选交互的`startTime`、以及该帧内最后一个事件的`processingEnd`时间重叠的
     * `long-animation-frame`条目；
     * 若浏览器不支持该API，或未检测到相关条目，则数组为空。
     */
    longAnimationFrameEntries: PerformanceLongAnimationFrameTiming[]
    /**
     * 从用户触发页面交互，到浏览器首次开始处理该交互的事件监听器的耗时。
     * 该时间反映了因主线程被其他任务占用，导致事件处理无法立即开始的延迟。
     */
    inputDelay: number
    /**
     * 从首个事件监听器响应用户交互开始执行，到所有事件监听器处理完成的耗时。
     */
    processingDuration: number
    /**
     * 从浏览器完成所有交互事件监听器的处理，到下一帧内容渲染到屏幕并对用户可见的耗时。
     * 该时间包含：
     * - 主线程工作：如`requestAnimationFrame`回调、`ResizeObserver`/`IntersectionObserver`回调、样式/布局计算；
     * - 非主线程工作：如合成器（compositor）、GPU、光栅化（raster）工作。
     */
    presentationDelay: number
    /**
     * 与INP对应的交互发生时，文档所处的加载状态（详见LoadState类型说明）。
     * 若交互发生在文档加载并执行脚本的阶段（通常为`dom-interactive`阶段），可能导致较长的交互延迟。
     */
    loadState: LoadState
}

/**
 * 带归因信息的INP专属Metric对象（继承基础INPMetric，扩展INP问题归因数据）。
 */
export interface INPMetricWithAttribution extends INPMetric {
    attribution: INPAttribution
}
