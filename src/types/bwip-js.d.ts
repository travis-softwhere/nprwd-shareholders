declare module "bwip-js" {
    interface BwipOptions {
        bcid: string
        text: string
        scale?: number
        height?: number
        includetext?: boolean
        textxalign?: string
        [key: string]: any
    }

    interface Bwip {
        toBuffer(options: BwipOptions, callback: (err: Error | null, png: Buffer) => void): void
    }

    const bwip: Bwip
    export default bwip
}  