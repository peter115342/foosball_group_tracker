import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import DashboardPage from '@/app/dashboard/page';

jest.mock('@/context/authContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', displayName: 'Test User' },
    loading: false,
  }),
}));

jest.mock('firebase/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockOnSnapshot = (_query: any, callback: (arg0: { forEach: (_fn: any) => void; empty: boolean; }) => void) => {
    setTimeout(() => {
      callback({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        forEach: (_fn: any) => {},
        empty: true
      });
    }, 0);
    
    return jest.fn();
  };
  
  return {
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    onSnapshot: mockOnSnapshot,
    doc: jest.fn(),
    deleteDoc: jest.fn(),
    getDoc: jest.fn().mockResolvedValue({
      exists: () => false,
      data: () => ({
        groupCount: 0,
        lastGroupCreation: null
      }),
    }),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getDocs: jest.fn().mockResolvedValue({
      empty: true,
      forEach: jest.fn(),
    }),
  };
});

jest.mock('@/lib/firebase/config', () => ({
  db: {},
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/components/groups/GroupFormDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="group-form-dialog" />,
}));

jest.mock('@/components/groups/JoinGroupForm', () => ({
  __esModule: true,
  default: () => <div data-testid="join-group-form" />,
}));

jest.mock('@/components/groups/ManageMembersDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="manage-members-dialog" />,
}));

describe('DashboardPage', () => {
  it('renders the dashboard page with groups placeholder', async () => {
    await act(async () => {
      render(<DashboardPage />);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Groups')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Create Group')).toBeInTheDocument();
    expect(screen.getByText('Join Group')).toBeInTheDocument();
    
    expect(screen.getByTestId('group-form-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('join-group-form')).toBeInTheDocument();
  });
});
