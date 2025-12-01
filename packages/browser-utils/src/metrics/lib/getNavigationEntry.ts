/**
 * 获取性能导航计时数据（PerformanceNavigationTiming）
 * 该数据包含页面导航的核心性能指标（如首字节时间、响应完成时间等）
 * @returns {erformanceNavigationTiming | void} 符合校验条件的导航计时对象
 *          - 校验条件：1. 导航对象存在 2. responseStart>0（响应已开始）3. responseStart<当前性能时间（时间戳合法）
 */
export const getNavigationEntry = (): PerformanceNavigationTiming | void => {
    const navigationEntry = self.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]

    if (navigationEntry && navigationEntry.responseStart > 0 && navigationEntry.responseStart < performance.now()) {
        return navigationEntry
    }
}
