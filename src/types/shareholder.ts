export interface Shareholder {
    id: number
    name: string
    shareholderId: string
    totalProperties: number
    checkedInProperties: number
    isNew: boolean
}

export interface ShareholdersListResponse {
    shareholders: Shareholder[]
    totalShareholders: number
}  