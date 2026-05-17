import { prisma } from "../lib/prisma";
import merchantDict from "../data/merchantDictionary.json";

export async function autoCategorize(merchant: string, fallback?: string) {
    // check in merchant override memory (AIMemory)
    const key = `merchantCategoryMap`;
    const mem = await prisma.aIMemory.findFirst({ where: { key } });
    let map: Record<string, string> = {};
    if (mem) {
        try {
            map = JSON.parse(mem.value || "{}");
        } catch (e) {
            map = {};
        }
    }

    const lc = merchant.toLowerCase();
    if (map[lc]) return { category: map[lc], confidence: 0.95 };

    // check static dictionary
    for (const k of Object.keys(merchantDict)) {
        if (lc.includes(k)) {
            return { category: (merchantDict as any)[k].category, confidence: 0.85 };
        }
    }

    // fallback
    return { category: fallback ?? "Miscellaneous", confidence: 0.5 };
}

export async function teachMerchantCategory(merchant: string, category: string) {
    const key = `merchantCategoryMap`;
    const mem = await prisma.aIMemory.findFirst({ where: { key } });
    let map: Record<string, string> = {};
    if (mem) {
        try {
            map = JSON.parse(mem.value || "{}");
        } catch (e) { map = {}; }
    }
    map[merchant.toLowerCase()] = category;
    if (mem) {
        await prisma.aIMemory.update({ where: { id: mem.id }, data: { value: JSON.stringify(map) } });
    } else {
        await prisma.aIMemory.create({ data: { key, value: JSON.stringify(map), tags: JSON.stringify(["merchant-map"]) } });
    }
    return map;
}
