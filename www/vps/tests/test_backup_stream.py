"""Backup transfer guards; these tests do not connect to the VPS."""

import hashlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup_vps', Path(__file__).resolve().parents[1] / 'scripts/backup-vps-db.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupStreamTests(unittest.TestCase):
    def test_binary_copy_and_checksum(self):
        payload = b'PGDMP' + bytes(range(256)) * 9000
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'archive.partial'
            with path.open('wb') as output:
                size, checksum = backup.copy_archive(io.BytesIO(payload), output, directory, 0)
            self.assertEqual(path.read_bytes(), payload)
        self.assertEqual(size, len(payload))
        self.assertEqual(checksum, hashlib.sha256(payload).hexdigest())

    def test_shell_banner_and_low_disk_are_not_accepted_as_backups(self):
        with tempfile.TemporaryDirectory() as directory, (Path(directory) / 'archive.partial').open('wb') as output:
            with self.assertRaisesRegex(ValueError, 'not a PostgreSQL'):
                backup.copy_archive(io.BytesIO(b'Welcome to server'), output, directory, 0)
            with patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=1)), self.assertRaisesRegex(RuntimeError, 'free-space'):
                backup.copy_archive(io.BytesIO(b'PGDMP123'), output, directory, 1024)

    def test_ssh_target_is_not_an_option_or_shell_expression(self):
        for target in ['-oProxyCommand=bad', 'host; bad', 'host $(bad)', 'user@host\ncommand']:
            with self.assertRaises(ValueError):
                backup.ssh_options(target)
        self.assertIn('StrictHostKeyChecking=yes', backup.ssh_options('ubuntu@server'))
        self.assertEqual(backup.ssh_options('ubuntu@server')[-1], 'ubuntu@server')


if __name__ == '__main__':
    unittest.main()
