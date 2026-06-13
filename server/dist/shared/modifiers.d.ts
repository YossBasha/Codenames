export interface Modifier {
    id: string;
    name: string;
    nameAr?: string;
    category: "spymaster" | "board" | "guesser";
    categoryAr?: string;
    description: string;
    descriptionAr?: string;
    icon: string;
}
export declare const MODIFIERS: Modifier[];
export declare function checkRhyme(word1: string, word2: string, isArabic: boolean): boolean;
//# sourceMappingURL=modifiers.d.ts.map