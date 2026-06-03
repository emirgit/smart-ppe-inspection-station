/**
 * Manual mock for storage.service.
 * Replaces the real R2/S3 implementation so tests never touch the network.
 */

const uploadPhoto = jest.fn().mockResolvedValue({
  url: 'https://mock-r2.example.com/photos/worker-1-000.jpg',
  key: 'photos/worker-1-000.jpg',
});

const deletePhoto = jest.fn().mockResolvedValue(undefined);

const keyFromUrl = jest.fn((photoUrl) => {
  if (!photoUrl) return null;
  const prefix = 'https://mock-r2.example.com/';
  return photoUrl.startsWith(prefix) ? photoUrl.slice(prefix.length) : null;
});

module.exports = { uploadPhoto, deletePhoto, keyFromUrl };
