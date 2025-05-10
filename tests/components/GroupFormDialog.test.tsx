import React from 'react';
import { render, screen } from '@testing-library/react';
import GroupFormDialog from '@/components/groups/GroupFormDialog';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true, data: () => ({ groupCount: 0 }) })),
  setDoc: jest.fn(),
}));

jest.mock('@/lib/firebase/config', () => ({
  db: {},
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

describe('GroupFormDialog', () => {
  const mockUser = {
    uid: 'test-user-id',
    displayName: 'Test User',
  };

  it('renders the dialog when open', () => {
    render(
      <GroupFormDialog
        isOpen={true}
        onOpenChange={jest.fn()}
        user={mockUser}
        onDialogClose={jest.fn()}
      />
    );
    
    expect(screen.getByText('Create New Group')).toBeInTheDocument();
    expect(screen.getByText('Group Name')).toBeInTheDocument();
    expect(screen.getByText('Team 1 Color')).toBeInTheDocument();
    expect(screen.getByText('Team 2 Color')).toBeInTheDocument();
    expect(screen.getByText('Guest Players')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <GroupFormDialog
        isOpen={false}
        onOpenChange={jest.fn()}
        user={mockUser}
        onDialogClose={jest.fn()}
      />
    );
    
    expect(screen.queryByText('Create New Group')).not.toBeInTheDocument();
  });
});
