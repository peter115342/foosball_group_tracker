import React from 'react';
import { render, screen } from '@testing-library/react';
import ManageMembersDialog from '@/components/groups/ManageMembersDialog';
import { User } from 'firebase/auth';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('@/lib/firebase/config', () => ({
  db: {},
  functions: {},
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

describe('ManageMembersDialog', () => {
  // Create a more complete mock of Firebase User
  const mockCurrentUser = {
    uid: 'admin-user-id',
    displayName: 'Admin User',
    email: 'admin@example.com',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: '2023-01-01T00:00:00Z',
      lastSignInTime: '2023-01-01T00:00:00Z',
    },
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    phoneNumber: null,
    providerId: 'firebase',
  } as User;

  const mockGroup = {
    id: 'test-group-id',
    name: 'Test Group',
    adminUid: 'admin-user-id',
    members: {
      'admin-user-id': { name: 'Admin User', role: 'admin' },
      'member-user-id': { name: 'Member User', role: 'viewer' },
    },
    guests: [{ id: 'guest1', name: 'Guest 1' }],
    inviteCode: 'TEST1234',
  };

  it('renders the dialog with members and guests when open', () => {
    render(
      <ManageMembersDialog
        isOpen={true}
        onOpenChange={jest.fn()}
        group={mockGroup}
        currentUser={mockCurrentUser}
      />
    );
    
    expect(screen.getByText('Manage Group')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Guest Players')).toBeInTheDocument();
    
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Member User')).toBeInTheDocument();
    
    expect(screen.getByText('Guest 1')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ManageMembersDialog
        isOpen={false}
        onOpenChange={jest.fn()}
        group={mockGroup}
        currentUser={mockCurrentUser}
      />
    );
    
    expect(screen.queryByText('Manage Group')).not.toBeInTheDocument();
  });
});
