import { Professions, ICompanyAccess, TradeUnions, ICompany } from "./model";

export interface IAliceAccount {
    _id: string;
    _rev?: string;
    password: string;
    login: string;
    professions: Professions;
    companyAccess: ICompanyAccess[];

    jobs: {
        tradeUnion: TradeUnions;
        companyBonus: ICompany[];
    }
}