import express from "express";
import { verifyauth } from "../middlewares/middleware.js";
const router = express.Router();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient()



router.get('/submission/:id',verifyauth,async(req,res,next)=>{
    const id = req.params.id;
    const userid = req?.userid
    console.log(userid)
    try{
        const submission = await prisma.submission.findUnique({
            where:{
                problemId:parseInt(id),
                userId:userid
            },
            include:{
                problem,
                status,
                testcasesPassed,
                runtime,
            }
        })
        return res.status(200).json(submission)
    }
    catch(err){
        console.log(err);
        return res.status(401).json(err);
    }
})

router.post('/submission/:id',verifyauth,async(req,res,next)=>{
    const id = req.params.id;
    const userid = req?.userid
    const{code,language} = req.body
    try{
        const newsubmission = await prisma.submission.create({
            where:{
                problemId:parseInt(id),
                userId:userid,
                source_code:code,
                language:language
            }
        })
        return res.status(200).json(newsubmission)
    }
    catch(err){
        console.log(err);
        return res.status(401).json(err);
    }
})



router.patch('/submission/:id',verifyauth,async(req,res,next)=>{
    const id = req.params.id;
    const userid = req?.userid;
    const{testcasesPassed,stdout,status} = req.body
    try{
        if(status==="Successful"){
            //TODO:move to the cleaner worker
        }
        const updatesubmission = await prisma.submission.update({
            where:{
                id,
                userId:userid
            },
            data:{
                testCasesPassed:testcasesPassed,
                stdout,
                status
            }
        })
    }
    catch(err){
        console.log(err);
        return res.status(401).json(err);
    }
})


export default router