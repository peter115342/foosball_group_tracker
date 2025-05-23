'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from "react-hook-form";
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '@/lib/firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

const NAME_MAX_LENGTH = 30;
const GUEST_NAME_MAX_LENGTH = 20;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9 ]+$/;

interface User {
  uid: string;
  displayName: string | null;
}

type GroupFormInputs = {
  groupName: string;
  teamOneColor: string;
  teamTwoColor: string;
};

interface GuestData {
  id: string;
  name: string;
}

interface GroupFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onDialogClose?: () => void;
}

const predefinedTeamColors = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
];

const readableGroupColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#F8A5C2', 
  '#8A84E2', '#54A0FF', '#50C878', '#FF9F43', '#A55EEA', 
  '#FF7F50', '#1DD1A1'
];

const getRandomGroupColor = () => {
  const randomIndex = Math.floor(Math.random() * readableGroupColors.length);
  return readableGroupColors[randomIndex];
};

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function GroupFormDialog({
  isOpen,
  onOpenChange,
  user,
  onDialogClose
}: GroupFormDialogProps) {
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [createGuestNameInput, setCreateGuestNameInput] = useState('');
  const [createGuestMembers, setCreateGuestMembers] = useState<GuestData[]>([]);
  const [rateLimit, setRateLimit] = useState<{
    remaining: number;
    nextAvailable: Date | null;
  } | null>(null);
  const [guestInputError, setGuestInputError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch
  } = useForm<GroupFormInputs>({
    defaultValues: {
      groupName: "",
      teamOneColor: "#FF0000",
      teamTwoColor: "#0000FF",
    }
  });

  useEffect(() => {
    if (user && isOpen) {
      const fetchRateLimits = async () => {
        try {
          const ratelimitRef = doc(db, 'ratelimits', user.uid);
          const ratelimitDoc = await getDoc(ratelimitRef);
          
          if (ratelimitDoc.exists()) {
            const data = ratelimitDoc.data();
            const groupsRemaining = 20 - (data.groupCount || 0);
            
            let nextAvailable = null;
            if (data.lastGroupCreation) {
              const lastCreation = data.lastGroupCreation.toDate();
              const cooldownTime = new Date(lastCreation.getTime() + (60 * 1000)); // 1 min in ms
              
              if (cooldownTime > new Date()) {
                nextAvailable = cooldownTime;
              }
            }
            
            setRateLimit({ remaining: groupsRemaining, nextAvailable });
          } else {
            await setDoc(ratelimitRef, {
              groupCount: 0
            });
            setRateLimit({ remaining: 20, nextAvailable: null });
          }
        } catch (error) {
          console.error("Error fetching rate limits:", error);
        }
      };
      
      fetchRateLimits();
    }
  }, [user, isOpen]);

  const watchedTeamOneColor = watch('teamOneColor');
  const watchedTeamTwoColor = watch('teamTwoColor');

  const validateGuestName = (name: string): string | null => {
    if (name.length === 0) return null;
    if (name.length > GUEST_NAME_MAX_LENGTH) 
      return `Name must be ${GUEST_NAME_MAX_LENGTH} characters or less`;
    if (!ALPHANUMERIC_REGEX.test(name)) 
      return "Name must contain only letters, numbers, and spaces";
    return null;
  };

  const handleGuestNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCreateGuestNameInput(value);
    setGuestInputError(validateGuestName(value));
  };

  const handleAddGuest = () => {
    const trimmedName = createGuestNameInput.trim();
    if (!trimmedName) return;
    
    const error = validateGuestName(trimmedName);
    if (error) {
      setGuestInputError(error);
      return;
    }
    
    if (createGuestMembers.length >= 30) {
      toast.error("Guest limit reached", { 
        description: "A group can have a maximum of 30 guest players." 
      });
      return;
    }
    
    const existingGuest = createGuestMembers.find(guest => guest.name.toLowerCase() === trimmedName.toLowerCase());

    if (!existingGuest) {
      const guestId = uuidv4();
      setCreateGuestMembers([...createGuestMembers, { id: guestId, name: trimmedName }]);
      setCreateGuestNameInput('');
      setGuestInputError(null);
    } else {
      toast.warning("Guest with this name already exists.");
    }
  };

  const handleRemoveGuest = (guestIdToRemove: string) => {
    setCreateGuestMembers(createGuestMembers.filter(guest => guest.id !== guestIdToRemove));
  };

  const onSubmit: SubmitHandler<GroupFormInputs> = async (data) => {
    if (!user) {
      toast.error("User not logged in.");
      return;
    }
    
    if (createGuestMembers.length > 30) {
      toast.error("Guest limit exceeded", { 
        description: "A group can have a maximum of 30 guest players." 
      });
      return;
    }
    
    if (rateLimit) {
      if (rateLimit.remaining <= 0) {
        toast.error("Rate limit exceeded", { 
          description: "You've reached the maximum number of groups (20) allowed per user." 
        });
        return;
      }
      
      if (rateLimit.nextAvailable) {
        const timeRemaining = Math.ceil((rateLimit.nextAvailable.getTime() - Date.now()) / 1000);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        toast.error("Rate limit cooldown active", { 
          description: `Please wait ${minutes}m ${seconds}s before creating another group.` 
        });
        return;
      }
    }
    
    setIsSubmittingGroup(true);
    try {
      const groupsCollectionRef = collection(db, "groups");

      const fullAdminName = user.displayName || `Admin_${user.uid.substring(0, 5)}`;
      
      const inviteCode = generateInviteCode();
      
      const membersMap = {
        [user.uid]: {
          name: fullAdminName,
          role: 'admin'
        }
      };

      const selectedGroupColor = getRandomGroupColor();

      const newGroupData = {
        name: data.groupName,
        adminUid: user.uid,
        adminName: fullAdminName,
        inviteCode: inviteCode,
        createdAt: serverTimestamp(),
        members: membersMap,
        guests: createGuestMembers,
        teamColors: {
          teamOne: data.teamOneColor,
          teamTwo: data.teamTwoColor,
        },
        groupColor: selectedGroupColor,
      };
      
      await addDoc(groupsCollectionRef, newGroupData);
      
      toast.success("Group created successfully!");

      onOpenChange(false);
      reset();
      setCreateGuestMembers([]);
      setCreateGuestNameInput('');
    } catch (error) {
      console.error("Error creating group:", error);
      if (error instanceof Error && 
          error.message.includes("permission") && 
          error.message.includes("insufficient")) {
        toast.error("Rate limit reached", { 
          description: "You must wait 1 minute between creating groups and can create a maximum of 20 groups."
        });
      } else {
        toast.error("Error creating group", { description: (error as Error).message });
      }
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        reset();
        setCreateGuestMembers([]);
        setCreateGuestNameInput('');
        setGuestInputError(null);
        if (onDialogClose) {
          onDialogClose();
        }
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription className="mb-1">
            Set the team colors matching your foosball table.
          </DialogDescription>
        </DialogHeader>

        {rateLimit && (
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-md text-sm">
            <span className="font-semibold">{rateLimit.remaining}</span> groups remaining out of 20 maximum.
            
            {rateLimit.nextAvailable && (
              <div className="mt-2">
                Cooldown active.
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid sm:grid-cols-4 grid-cols-1 items-center gap-4">
              <Label htmlFor="groupName" className="sm:text-right text-left">Group Name</Label>
              <div className="sm:col-span-3">
                <Input
                  id="groupName"
                  className={cn(
                    errors.groupName ? "border-red-500 focus-visible:ring-red-500" : ""
                  )}
                  {...register("groupName", { 
                    required: "Group name is required",
                    maxLength: {
                      value: NAME_MAX_LENGTH,
                      message: `Group name must be ${NAME_MAX_LENGTH} characters or less`
                    },
                    pattern: {
                      value: ALPHANUMERIC_REGEX,
                      message: "Group name must contain only letters, numbers, and spaces"
                    },
                    validate: {
                      notOnlyWhitespace: value => value.trim().length > 0 || "Group name cannot be empty or only spaces"
                    }
                  })}
                  disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                />
                {errors.groupName && (
                  <div className="flex items-center mt-1 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span>{errors.groupName.message}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-4 grid-cols-1 items-center gap-4">
              <Label htmlFor="teamOneColor" className="sm:text-right text-left">Team 1 Color</Label>
              <div className="sm:col-span-3 flex gap-2 items-center">
                <Input
                  id="teamOneColor"
                  type="color"
                  className="w-10 h-10 p-1 cursor-pointer"
                  {...register("teamOneColor")}
                  disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {predefinedTeamColors.map(color => (
                    <button
                      key={color.name + '1'}
                      type="button"
                      title={color.name}
                      className={`w-6 h-6 rounded-full border ${watchedTeamOneColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setValue("teamOneColor", color.hex)}
                      disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 grid-cols-1 items-center gap-4">
              <Label htmlFor="teamTwoColor" className="sm:text-right text-left">Team 2 Color</Label>
              <div className="sm:col-span-3 flex gap-2 items-center">
                <Input
                  id="teamTwoColor"
                  type="color"
                  className="w-10 h-10 p-1 cursor-pointer"
                  {...register("teamTwoColor")}
                  disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {predefinedTeamColors.map(color => (
                    <button
                      key={color.name + '2'}
                      type="button"
                      title={color.name}
                      className={`w-6 h-6 rounded-full border ${watchedTeamTwoColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setValue("teamTwoColor", color.hex)}
                      disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 grid-cols-1 items-start gap-4 mt-2">
              <div className="flex justify-between items-center col-span-1 sm:col-span-4">
                <Label className="sm:text-right text-left pt-2">Guest Players</Label>
                <span className="text-xs text-muted-foreground">{createGuestMembers.length}/50</span>
              </div>
              <div className="sm:col-span-4 col-span-1 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Add guest name"
                      value={createGuestNameInput}
                      onChange={handleGuestNameChange}
                      className={cn(
                        guestInputError ? "border-red-500 focus-visible:ring-red-500" : ""
                      )}
                      disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGuest();
                        }
                      }}
                    />
                    {guestInputError && (
                      <div className="flex items-center mt-1 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span>{guestInputError}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddGuest}
                    disabled={!createGuestNameInput.trim() || !!guestInputError || isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                {createGuestMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {createGuestMembers.map(guest => (
                      <div key={guest.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm">
                        {guest.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto ml-1"
                          onClick={() => handleRemoveGuest(guest.id)}
                          disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button 
                type="button" 
                variant="outline" 
                disabled={isSubmittingGroup}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              disabled={isSubmittingGroup || (rateLimit?.nextAvailable !== null)}
            >
              {isSubmittingGroup 
                ? 'Creating...' 
                : (rateLimit?.nextAvailable 
                    ? `Create Group (${Math.ceil((rateLimit.nextAvailable.getTime() - Date.now()) / 1000)}s)` 
                    : 'Create Group')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
