import { HttpContextToken, HttpInterceptorFn } from "@angular/common/http";
import { API_BASE_URL } from "../constants/api.constants";

export const BYPASS_API = new HttpContextToken<boolean>(() => false);

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
    if (req.context.get(BYPASS_API)) {
        return next(req);
    }
    const apiReq = req.clone({
        url: API_BASE_URL + req.url
    });

    return next(apiReq);
}