import { API_PATHS } from "./apiPath";
import axiosInstance from "./axiosInstance";

const uploadProfile = async (imageFile, userId) => {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("image", imageFile);

  try {
    const response = await axiosInstance.post(
      API_PATHS.IMAGE.UPLOAD_PROFILE,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data", // Set header for file upload
        },
      }
    );
    return response.data; // Return response data
  } catch (error) {
    console.error("Error uploading the image:", error);
    throw error;
  }
};

export default uploadProfile;
