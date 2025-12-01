import type { LoadState, Metric } from './base'

export interface CLSMetric extends Metric {
    name: 'CLS'
    entries: LayoutShift[]
}

export interface CLSAttribution {
    /**
     * 标识导致页面CLS分数的「单次最大布局偏移」发生时，首个（按文档顺序）产生偏移的元素选择器。
     */
    largestShiftTarget?: string
    /**
     * 导致页面CLS分数的「单次最大布局偏移」发生的时间戳。
     */
    largestShiftTime?: DOMHighResTimeStamp
    /**
     * 导致页面CLS分数的「单次最大布局偏移」的布局偏移分数。
     */
    largestShiftValue?: number
    /**
     * 代表导致页面CLS分数的「单次最大布局偏移」的LayoutShiftEntry对象。
     * （当你需要的信息超出largestShiftTarget、largestShiftTime和largestShiftValue时，该属性会很有用）
     */
    largestShiftEntry?: LayoutShift
    /**
     * 在largestShiftEntry对象的sources列表中，首个（按文档顺序）的元素来源信息。
     * （同样适用于需要更多偏移细节，而非仅上述三个基础属性的场景）
     */
    largestShiftSource?: LayoutShiftAttribution
    /**
     * 当导致页面CLS分数的最大布局偏移发生时，文档所处的加载状态（详见LoadState类型说明）。
     */
    loadState?: LoadState
}

/**
 * 带归因信息的CLS专属Metric对象（继承基础CLS指标，扩展布局偏移归因数据）。
 */
export interface CLSMetricWithAttribution extends CLSMetric {
    attribution: CLSAttribution
}
