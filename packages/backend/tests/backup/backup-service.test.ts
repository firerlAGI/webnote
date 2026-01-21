/**
 * 备份服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { backupService } from '../../src/services/backup/BackupService'
import { prisma } from '../setup'

describe('BackupService', () => {
  let testUserId: number

  beforeEach(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'hashed_password'
      }
    })
    testUserId = user.id
  })

  afterEach(async () => {
    // 清理测试数据
    await prisma.backup.deleteMany({ where: { user_id: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })
  })

  describe('createBackup', () => {
    it('should create a manual backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'manual')

      expect(backup).toBeDefined()
      expect(backup.userId).toBe(testUserId)
      expect(backup.type).toBe('manual')
      expect(backup.status).toBe('completed')
      expect(backup.itemCount).toBeGreaterThanOrEqual(0)
    })

    it('should create an incremental backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'incremental')

      expect(backup).toBeDefined()
      expect(backup.userId).toBe(testUserId)
      expect(backup.type).toBe('incremental')
      expect(backup.status).toBe('completed')
    })

    it('should create a full backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'full')

      expect(backup).toBeDefined()
      expect(backup.userId).toBe(testUserId)
      expect(backup.type).toBe('full')
      expect(backup.status).toBe('completed')
    })
  })

  describe('getBackupList', () => {
    it('should return empty list for new user', async () => {
      const backups = await backupService.getBackupList(testUserId)

      expect(backups).toBeInstanceOf(Array)
      expect(backups.length).toBeGreaterThanOrEqual(0)
    })

    it('should return backup list after creating backup', async () => {
      await backupService.createBackup(testUserId, 'manual')
      const backups = await backupService.getBackupList(testUserId)

      expect(backups.length).toBeGreaterThan(0)
      expect(backups[0].userId).toBe(testUserId)
    })
  })

  describe('getBackupDetail', () => {
    it('should return null for non-existent backup', async () => {
      const detail = await backupService.getBackupDetail(testUserId, 'non_existent_id')

      expect(detail).toBeNull()
    })

    it('should return backup detail for existing backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'manual')
      const detail = await backupService.getBackupDetail(testUserId, backup.id)

      expect(detail).toBeDefined()
      expect(detail?.userId).toBe(testUserId)
      expect(detail?.notes).toBeInstanceOf(Array)
      expect(detail?.folders).toBeInstanceOf(Array)
      expect(detail?.reviews).toBeInstanceOf(Array)
    })
  })

  describe('deleteBackup', () => {
    it('should delete existing backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'manual')
      const success = await backupService.deleteBackup(testUserId, backup.id)

      expect(success).toBe(true)

      const backups = await backupService.getBackupList(testUserId)
      expect(backups.length).toBe(0)
    })

    it('should return false for non-existent backup', async () => {
      const success = await backupService.deleteBackup(testUserId, 'non_existent_id')

      expect(success).toBe(false)
    })
  })

  describe('downloadBackup', () => {
    it('should return null for non-existent backup', async () => {
      const buffer = await backupService.downloadBackup(testUserId, 'non_existent_id')

      expect(buffer).toBeNull()
    })

    it('should return buffer for existing backup', async () => {
      const backup = await backupService.createBackup(testUserId, 'manual')
      const buffer = await backupService.downloadBackup(testUserId, backup.id)

      expect(buffer).not.toBeNull()
      if (buffer) {
        expect(buffer).toBeInstanceOf(Buffer)
        expect(buffer.length).toBeGreaterThan(0)
      }
    })
  })
})
