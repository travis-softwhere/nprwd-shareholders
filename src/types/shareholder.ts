export interface Shareholder {
    id: number
    name: string
    shareholderId: string
    totalProperties: number
    checkedInProperties: number
}

export interface ShareholdersListResponse {
    shareholders: Shareholder[]
    totalShareholders: number
}  