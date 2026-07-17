import bcrypt from 'bcryptjs';
import { User } from '../db/entities/User.js';
import { UserRepository, getUserRepository } from '../db/repositories/UserRepository.js';

/**
 * UserService - Business logic layer for user management
 * Handles user operations with proper validation and business rules
 */
export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository?: UserRepository) {
    this.userRepository = userRepository || getUserRepository();
  }

  /**
   * Get all users (without passwords)
   */
  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.findAll();
    return users.map(({ password: _password, ...user }) => ({
      ...user,
      password: undefined,
    }));
  }

  /**
   * Get user by username (without password)
   */
  async getUserByUsername(username: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) return null;
    
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'password'>;
  }

  /**
   * Get user by username (with password for auth)
   */
  async getUserByUsernameWithPassword(username: string): Promise<User | null> {
    return await this.userRepository.findByUsername(username);
  }

  /**
   * Create a new user
   */
  async createUser(username: string, plainPassword: string, isAdmin: boolean = false): Promise<Omit<User, 'password'> | null> {
    try {
      // Check if username already exists
      const exists = await this.userRepository.usernameExists(username);
      if (exists) {
        return null;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      // Create user
      const user = await this.userRepository.create({
        username,
        password: hashedPassword,
        isAdmin
      });

      const { password: _password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(
    username: string,
    data: { isAdmin?: boolean; newPassword?: string; canAccessMarket?: boolean; canCreateServer?: boolean }
  ): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        return null;
      }

      const updateData: Partial<User> = {};

      // Update admin status if provided
      if (data.isAdmin !== undefined) {
        // Check if this is the last admin
        if (user.isAdmin && !data.isAdmin) {
          const adminCount = await this.userRepository.countAdmins();
          if (adminCount === 1) {
            throw new Error('Cannot remove admin status from the last admin user');
          }
        }
        updateData.isAdmin = data.isAdmin;
      }

      // Update password if provided
      if (data.newPassword) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(data.newPassword, salt);
      }

      // Update permissions if provided
      if (data.canAccessMarket !== undefined) (updateData as any).canAccessMarket = data.canAccessMarket;
      if (data.canCreateServer !== undefined) (updateData as any).canCreateServer = data.canCreateServer;

      // Update user
      const updatedUser = await this.userRepository.updateByUsername(username, updateData);
      if (!updatedUser) {
        return null;
      }

      const { password: _password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(username: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        return false;
      }

      // Check if this is the last admin
      if (user.isAdmin) {
        const adminCount = await this.userRepository.countAdmins();
        if (adminCount === 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      return await this.userRepository.deleteByUsername(username);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Verify user password
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update user password
   */
  async updateUserPassword(username: string, newPassword: string): Promise<boolean> {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      const updated = await this.userRepository.updateByUsername(username, {
        password: hashedPassword,
        updatedAt: new Date()
      });

      return updated !== null;
    } catch (error) {
      console.error('Failed to update password:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  async isUserAdmin(username: string): Promise<boolean> {
    const user = await this.userRepository.findByUsername(username);
    return user?.isAdmin || false;
  }

  /**
   * Get user count
   */
  async getUserCount(): Promise<number> {
    return await this.userRepository.count();
  }

  /**
   * Get admin count
   */
  async getAdminCount(): Promise<number> {
    return await this.userRepository.countAdmins();
  }

  /**
   * Update login statistics (called on successful login)
   */
  async updateLoginStats(username: string): Promise<void> {
    try {
      const user = await this.userRepository.findByUsername(username);
      if (!user) return;
      await this.userRepository.updateByUsername(username, {
        loginCount: (user.loginCount || 0) + 1,
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
      } as any);
    } catch (error) {
      console.error('Failed to update login stats:', error);
    }
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity(username: string): Promise<void> {
    try {
      await this.userRepository.updateByUsername(username, {
        lastActivityAt: new Date(),
      } as any);
    } catch (error) {
      // Silently ignore - non-critical
    }
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    username: string,
    permissions: { canAccessMarket?: boolean; canCreateServer?: boolean },
  ): Promise<boolean> {
    try {
      const updated = await this.userRepository.updateByUsername(username, {
        ...permissions,
        updatedAt: new Date(),
      } as any);
      return updated !== null;
    } catch (error) {
      console.error('Failed to update user permissions:', error);
      return false;
    }
  }


  /**
   * Batch create users
   */
  async batchCreateUsers(users: { username: string; password: string; isAdmin?: boolean }[]):
    Promise<{ created: string[]; failed: { username: string; reason: string }[] }> {
    const created: string[] = [];
    const failed: { username: string; reason: string }[] = [];
    for (const u of users) {
      try {
        const result = await this.createUser(u.username, u.password, u.isAdmin || false);
        if (result) created.push(u.username);
        else failed.push({ username: u.username, reason: 'already exists' });
      } catch (e) {
        failed.push({ username: u.username, reason: 'error' });
      }
    }
    return { created, failed };
  }

  /**
   * Batch update permissions
   */
  async batchUpdatePermissions(
    usernames: string[],
    permissions: { canAccessMarket?: boolean; canCreateServer?: boolean },
  ): Promise<{ updated: string[]; failed: string[] }> {
    const updated: string[] = [];
    const failed: string[] = [];
    for (const username of usernames) {
      const ok = await this.updateUserPermissions(username, permissions);
      if (ok) updated.push(username);
      else failed.push(username);
    }
    return { updated, failed };
  }

  /**
   * Batch delete users
   */
  async batchDeleteUsers(usernames: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const username of usernames) {
      try {
        const ok = await this.deleteUser(username);
        if (ok) deleted.push(username);
        else failed.push(username);
      } catch {
        failed.push(username);
      }
    }
    return { deleted, failed };
  }

  /**
   * Initialize default admin user if no users exist
   */
  async initializeDefaultAdmin(): Promise<void> {
    const userCount = await this.userRepository.count();
    if (userCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const admin = await this.userRepository.create({
        username: 'admin',
        password: hashedPassword,
        isAdmin: true,
        canAccessMarket: true,
        canCreateServer: true,
        loginCount: 0,
      });
      if (admin) {
        console.log('Default admin user created (username: admin, password: admin123)');
      }
    }
  }
}

// Singleton instance
let userServiceInstance: UserService | null = null;

export function getUserService(): UserService {
  if (!userServiceInstance) {
    userServiceInstance = new UserService();
  }
  return userServiceInstance;
}

// Export convenience functions for backward compatibility
// Use lazy initialization to avoid creating service before database is ready

export const getAllUsers = () => getUserService().getAllUsers();
export const getUserByUsername = (username: string) => getUserService().getUserByUsername(username);
export const createNewUser = (username: string, password: string, isAdmin?: boolean) => 
  getUserService().createUser(username, password, isAdmin);
export const updateUser = (username: string, data: { isAdmin?: boolean; newPassword?: string }) => 
  getUserService().updateUser(username, data);
export const deleteUser = (username: string) => getUserService().deleteUser(username);
export const isUserAdmin = (username: string) => getUserService().isUserAdmin(username);
export const getUserCount = () => getUserService().getUserCount();
export const getAdminCount = () => getUserService().getAdminCount();
