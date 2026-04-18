/**
 * @file user-avatar.tsx
 * @description User avatar with initials fallback.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: {
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <Avatar className={cn(sizeClass[size], className)}>
      {user.avatar && <AvatarImage src={user.avatar} />}
      <AvatarFallback className="bg-[#476e66] text-white font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}