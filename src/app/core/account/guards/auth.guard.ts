import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AccountService } from "../services/account.service";

export const authGuard: CanActivateFn = () => {
    const accountService = inject(AccountService);

    if (accountService.token()) {
        return true;
    }
    else {
        return inject(Router).createUrlTree(['/account/login']);
    }
} 