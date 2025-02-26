import { Request, Response, NextFunction } from 'express';
import { User } from '@shared/schema';

type AllowedRoles = 'admin' | 'editor' | 'viewer';

export function roleGuard(...roles: AllowedRoles[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    
    if (!user || !roles.includes(user.role as AllowedRoles)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}
