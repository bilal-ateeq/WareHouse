// Cloudinary service for handling image uploads
class CloudinaryService {
  constructor() {
    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  }

  async uploadImage(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', 'stock-management/products');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload image to Cloudinary');
      }

      const data = await response.json();
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async deleteImage(publicId) {
    try {
      // Note: For security reasons, deletion should be handled on the backend
      // This is a placeholder for future backend implementation
      console.log('Image deletion requested for:', publicId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting image:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new CloudinaryService();