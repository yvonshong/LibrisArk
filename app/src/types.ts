export interface Paper {
    id: string;
    title: string | null;
    path: string;
    year: number | null;
    doi: string | null;
}

export type LibraryFilterKind = "all" | "year" | "author" | "tag";

export interface LibraryFilter {
    kind: LibraryFilterKind;
    value: string | null;
}

export interface FacetItem {
    value: string;
    count: number;
}

export interface VirtualFacets {
    years: FacetItem[];
    authors: FacetItem[];
    tags: FacetItem[];
}

export interface Note {
    id: number;
    paperId: string;
    content: string;
    anchorText: string | null;
    createdAt: string;
}
