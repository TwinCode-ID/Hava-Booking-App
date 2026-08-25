import { API_PATHS } from "./apiPath";
import axiosInstance from "./axiosInstance";
import { validateImageUpload } from "./imageUploadValidation";

const uploadStudio = async (imageFile, userId) => {
  const validationError = validateImageUpload(imageFile);
  if (validationError) throw new Error(validationError);
  const formData = new FormData();

  formData.append("adminStudioLocation", userId);
  formData.append("image", imageFile);

  try {
    const response = await axiosInstance.post(
      API_PATHS.IMAGE.UPLOAD_STUDIO,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Studio image upload failed.");
    throw error;
  }
};

export default uploadStudio;
