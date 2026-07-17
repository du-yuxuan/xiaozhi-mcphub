import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  username: string;

  @Column({ type: 'varchar' })
  password: string; // Hashed password

  @Column({ type: 'boolean', default: false, name: 'is_admin' })
  isAdmin: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // 追踪字段
  @Column({ type: 'int', default: 0, name: 'login_count' })
  loginCount: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_activity_at' })
  lastActivityAt: Date | null;

  // 权限控制字段
  @Column({ type: 'boolean', default: false, name: 'can_access_market' })
  canAccessMarket: boolean;

  @Column({ type: 'boolean', default: false, name: 'can_create_server' })
  canCreateServer: boolean;
}

export default User;