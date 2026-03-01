import { API_PATHS } from "./apiPath";
import axiosInstance from "./axiosInstance";

const uploadProof = async (imageFile, userId) => {
  const formData = new FormData();

  formData.append("userId", userId);
  formData.append("image", imageFile);

  try {
    const response = await axiosInstance.post(
      API_PATHS.IMAGE.UPLOAD_PROOF,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error uploading the image:", error);
    throw error;
  }
};

export default uploadProof;
