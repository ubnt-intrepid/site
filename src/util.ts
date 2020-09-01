export const collectCounts = (list: string[]) => {
    let categoriesMap = new Map<string, number>();
    list
        .forEach(category => {
            const count = categoriesMap.get(category);
            categoriesMap.set(category, count ? count + 1 : 1);
        });

    return Array.from(categoriesMap.entries())
        .map(([name, count]) => ({ name, count }));
}
