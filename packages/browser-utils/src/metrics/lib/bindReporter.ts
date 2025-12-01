import { MetricRatingThresholds, MetricType } from '../types'

const getRating = (value: number, thresholds: MetricRatingThresholds): MetricType['rating'] => {
    if (value > thresholds[1]) {
        return 'poor'
    }

    if (value > thresholds[0]) {
        return 'needs-improvement'
    }

    return 'good'
}

/**
 * 绑定性能指标上报器，生成可触发上报的函数（核心逻辑：计算delta、判定评级、触发回调）
 * @template MetricName - 泛型约束：限定为MetricType中name字段的取值（如'CLS'/'FCP'/'LCP'等）
 * @param {Function} callback - 指标上报回调函数，接收最终的指标对象作为参数
 * @param {Extract<MetricType, { name: MetricName }>} metric - 待上报的性能指标对象（泛型限定为指定名称的指标类型）
 * @param {MetricRatingThresholds} thresholds - 该指标对应的评级阈值
 * @param {Boolean} [reportAllChanges] - 是否上报所有数值变化（默认false：仅上报有有效delta的情况）
 * @returns {Function} 可触发上报的函数，接收可选参数forceReport（是否强制上报）
 */
export const bindReporter = <MetricName extends MetricType['name']>(
    callback: (metric: Extract<MetricType, { name: MetricName }>) => void,
    metric: Extract<MetricType, { name: MetricName }>,
    thresholds: MetricRatingThresholds,
    reportAllChanges?: boolean
) => {
    let prevValue: number
    let delta: number

    return (forceReport?: boolean) => {
        if (metric.value > 0) {
            if (forceReport || reportAllChanges) {
                delta = metric.value - (prevValue || 0)

                if (delta || prevValue === undefined) {
                    prevValue = metric.value
                    metric.delta = delta
                    metric.rating = getRating(metric.value, thresholds)
                    callback(metric)
                }
            }
        }
    }
}
