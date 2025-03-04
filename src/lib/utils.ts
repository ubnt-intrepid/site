export const collectCounts = (values: string[]) => {
    const countsMap = new Map<string, number>();
    values
        .forEach(value => {
            const count = countsMap.get(value);
            countsMap.set(value, count ? count + 1 : 1);
        });

    return Array.from(countsMap.entries())
        .map(([name, count]) => ({ name, count }));
}
