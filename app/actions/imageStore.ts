"user server"

import { prisma } from "@/lib/prisma"


export async function storeImage(){
    const storeImage = await prisma.images.create({
        data:{
            url:"",
            extracted_text:"",
            image_hash:"",
            tags:[],
            
            

        }
    })
}