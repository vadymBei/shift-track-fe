import { HttpContextToken, HttpInterceptorFn } from "@angular/common/http";

export const BYPASS_API = new HttpContextToken<boolean>(() => false);

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
    if (req.context.get(BYPASS_API)) {
        return next(req);
    }
    const baseUrl = `http://localhost:11000/api/shift-track/`;
    const apiReq = req.clone({
        url: baseUrl + req.url
    });

    return next(apiReq);
}