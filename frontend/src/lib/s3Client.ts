import AWS from 'aws-sdk';

// Configure AWS with your access and secret key
const s3 = new AWS.S3({
    accessKeyId: '6b372b63750ae680b2a261398368298c', // Your access key
    secretAccessKey: 'your-secret-key', // Your secret key
    region: 'your-region' // e.g., 'us-east-1'
});

// Function to upload a video to S3
export const uploadVideoToS3 = async (file: File, userId: string) => {
    const params = {
        Bucket: 'your-bucket-name', // Your bucket name
        Key: `videos/${userId}/${file.name}`, // Path in the bucket
        Body: file,
        ContentType: file.type,
        ACL: 'public-read' // Adjust based on your needs
    };

    try {
        const data = await s3.upload(params).promise();
        return data.Location; // Returns the URL of the uploaded video
    } catch (error) {
        console.error('Error uploading video to S3:', error);
        throw error;
    }
}; 