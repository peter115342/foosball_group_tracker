'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from "react-hook-form";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, UserPlus } from 'lucide-react';

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

interface MemberData {
  name: string;
  isMember: boolean;
  isAdmin?: boolean;
}

interface GroupFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

const predefinedColors = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
];

export default function GroupFormDialog({ 
  isOpen, 
  onOpenChange, 
  user 
}: GroupFormDialogProps) {
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [createGuestNameInput, setCreateGuestNameInput] = useState('');
  const [createGuestMembers, setCreateGuestMembers] = useState<GuestData[]>([]);

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

  const watchedTeamOneColor = watch('teamOneColor');
  const watchedTeamTwoColor = watch('teamTwoColor');

  const handleAddGuest = () => {
    const trimmedName = createGuestNameInput.trim();
    if (trimmedName) {
      const existingGuest = createGuestMembers.find(guest => guest.name.toLowerCase() === trimmedName.toLowerCase());
      
      if (!existingGuest) {
        const guestId = uuidv4();
        setCreateGuestMembers([...createGuestMembers, { id: guestId, name: trimmedName }]);
        setCreateGuestNameInput('');
      } else {
        toast.warning("Guest with this name already exists.");
      }
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
    setIsSubmittingGroup(true);
    try {
      const groupsCollectionRef = collection(db, "groups");

      const fullAdminName = user.displayName || `Admin_${user.uid.substring(0, 5)}`;
      const memberFirstName = user.displayName?.split(' ')[0] || `Admin_${user.uid.substring(0, 5)}`;

      const membersMap: { [key: string]: MemberData } = {};
      membersMap[user.uid] = {
        name: memberFirstName,
        isMember: true,
        isAdmin: true
      };

      const newGroupData = {
        name: data.groupName,
        adminUid: user.uid,
        adminName: fullAdminName,
        createdAt: serverTimestamp(),
        members: membersMap,
        guests: createGuestMembers,
        teamColors: {
          teamOne: data.teamOneColor,
          teamTwo: data.teamTwoColor,
        },
      };
      await addDoc(groupsCollectionRef, newGroupData);
      toast.success("Group created successfully!");
      
      onOpenChange(false);
      reset();
      setCreateGuestMembers([]);
      setCreateGuestNameInput('');
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Error creating group", { description: (error as Error).message });
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
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Create a new foosball group to track matches with friends or colleagues.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="groupName" className="text-right">Group Name</Label>
              <Input 
                id="groupName" 
                className="col-span-3"
                {...register("groupName", { required: "Group name is required" })}
                disabled={isSubmittingGroup}
              />
              {errors.groupName && (
                <p className="col-span-4 text-right text-sm text-red-500">{errors.groupName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teamOneColor" className="text-right">Team 1 Color</Label>
              <div className="col-span-3 flex gap-2">
                <Input 
                  id="teamOneColor" 
                  type="color"
                  className="w-12 h-10 p-1 cursor-pointer"
                  {...register("teamOneColor")}
                  disabled={isSubmittingGroup}
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {predefinedColors.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      title={color.name}
                      className={`w-6 h-6 rounded-full border ${watchedTeamOneColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setValue("teamOneColor", color.hex)}
                      disabled={isSubmittingGroup}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teamTwoColor" className="text-right">Team 2 Color</Label>
              <div className="col-span-3 flex gap-2">
                <Input 
                  id="teamTwoColor" 
                  type="color"
                  className="w-12 h-10 p-1 cursor-pointer"
                  {...register("teamTwoColor")}
                  disabled={isSubmittingGroup}
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {predefinedColors.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      title={color.name}
                      className={`w-6 h-6 rounded-full border ${watchedTeamTwoColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setValue("teamTwoColor", color.hex)}
                      disabled={isSubmittingGroup}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4 mt-2">
              <Label className="text-right pt-2">Guest Players</Label>
              <div className="col-span-3 space-y-3">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Add guest name"
                    value={createGuestNameInput}
                    onChange={(e) => setCreateGuestNameInput(e.target.value)}
                    disabled={isSubmittingGroup}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddGuest();
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddGuest} 
                    disabled={!createGuestNameInput.trim() || isSubmittingGroup}
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
                          disabled={isSubmittingGroup}
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
            <Button type="submit" disabled={isSubmittingGroup}>
              {isSubmittingGroup ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
