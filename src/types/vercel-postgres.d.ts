declare module "@vercel/postgres" {
    export function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any>
    export interface VercelPoolClient { }
}