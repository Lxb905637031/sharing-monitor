import { getNavigationEntry } from './getNavigationEntry'

export const getActivationStart = (): number => {
    const navEntry = getNavigationEntry()

    return (navEntry && navEntry.activationStart) || 0
}
