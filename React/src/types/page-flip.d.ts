declare module "page-flip" {
  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    usePortrait?: boolean;
    autoSize?: boolean;
    [key: string]: any;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromImages(images: string[]): void;
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    flipNext(): void;
    flipPrev(): void;
    flip(pageNum: number): void;
    turnToPage(pageNum: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    destroy(): void;
    on(event: string, callback: (e: any) => void): void;
    off(event: string, callback?: (e: any) => void): void;
  }
}