const express = require('express')
const app = express()
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 3000
var cors = require('cors')
app.use(cors())
app.use(express.json())
const stripe = require("stripe")(`${process.env.PAYMENT_KEY}`);
const verify=(req,res,next)=>{
  console.log('hitting server')
    //  console.log(req.headers.authorize)
      const authorize=req.headers.authorize;
      if (!authorize) {
        return res.status(401).send({error:true,message:'unauthorize access'})
      }
      const token = authorize.split(' ')[1]
      console.log(token)
      jwt.verify(token,process.env.ACCESS_TOKEN,(error,decoded)=>{
        if(error){
         return res.status(401).send({error: true , message:"unauthorize access"})
        }
        req.decoded=decoded
        next()
      })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.hwuf8vx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("bistroDB");
    const menuCallaction = database.collection("menu");
    const cartCallection = database.collection("carts");
    const usersCallections = database.collection("users");
    const paymentCallections = database.collection("payment");


    app.post("/jwt",(req,res)=>{
       const user=req.body;
       const token= jwt.sign(user,process.env.ACCESS_TOKEN,{
        expiresIn: '72h'
       })
       res.send({token})
    })
     
    // verify Admin
    // use mongoDB
    const verifyAdmin= async(req,res,next)=>{
       const email=req.decoded.email;
       const query={email: email}
       const user= await usersCallections.findOne(query)
      if (user?.role !== "admin") {
         return res.status(403).send({error:true,message:'You Are Not Admin'})
      }
      next()
    }


    app.get('/users/admin/:email', verify, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
    
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
    
      const user = await usersCallections.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result);
    });

   /* *
   *1.verify jwt
   *2.do not show link 
   *3.
   */
    app.get("/users",verify,verifyAdmin,async(req,res)=>{
       const result=await usersCallections.find().toArray()
       res.send(result)
    })
    app.post('/users',async(req,res)=>{
      const users=req.body;
      const result= await usersCallections.insertOne(users)
      res.send(result)
    })
     app.delete('/users/:id',async(req,res)=>{
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result= await usersCallections.deleteOne(query)
      res.send(result)
     })
    app.patch('/users/admin/:id',async(req,res)=>{
      const id= req.params.id
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCallections.updateOne(filter,updateDoc)
      res.send(result)
    })
   
    // verifyJwt 
    // same email

    

    app.get("/menu", async (req, res) => {
      const result = await menuCallaction.find().toArray()
      res.send(result)
    })
    
   app.post('/menu',verify,verifyAdmin,async(req,res)=>{
       const newItem=req.body;
       const result=await menuCallaction.insertOne(newItem)
       res.send(result)
   })
   app.delete('/menu/:id',verify,verifyAdmin,async(req,res)=>{
             const id= req.params.id;
             const query={_id: new ObjectId(id)}  
             const result= await menuCallaction.deleteOne(query)
             res.send(result)
   })

    // cart callaction

    app.post('/carts', async (req, res) => {
      const cart = req.body;
      console.log(cart)
      const result = await cartCallection.insertOne(cart);
      res.send(result);
    })

    app.get('/carts', verify,async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const query = { email: email };
      console.log(email)
     
    
      const result = await cartCallection.find(query).toArray()
      res.send(result)
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCallection.deleteOne(query)
      res.send(result)
    })  

    // payment methord
    app.post('/create-payment-intent', verify, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100; // Convert price to cents (Stripe expects the amount in cents)
      
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
    
        res.send({
          clientSecret: paymentIntent.client_secret
        });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'Error creating payment intent' });
      }
    });   
    
    app.post('/payments',verify,async(req,res)=>{
         const payment=req.body;

         const query={_id:{$in: payment.itemsId.map(id => new ObjectId(id))}}
        const deletresult =  await cartCallection.deleteMany(query)
         const result= await paymentCallections.insertOne(payment)
         res.send({result,deletresult})
    })

     app.get('/admin-status',verify,verifyAdmin,async(req,res)=>{
      const users= await usersCallections.estimatedDocumentCount()
      const menuItem= await menuCallaction.estimatedDocumentCount()
      const order= await paymentCallections.estimatedDocumentCount()
      const payment= await paymentCallections.find().toArray()
      const revinew=payment.reduce((sum,payment)=>sum+ payment.price,0)
      res.send({
        users,
        menuItem,
        order,
        revinew,
      })
     })

     app.get('/manage-booking',async(req,res)=>{
      const result = await cartCallection.find().toArray()
      res.send(result) 
     })
    
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Server Running!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})