import smartpy as sp
FA2_contract = sp.io.import_stored_contract('FA2.py')


class TezoTix(sp.Contract):
    def __init__(self):
        self.init(

            # It contains the contract address of the NFT contract
            nft_contract_address=sp.address("KT1FUmcWZTmQWVvUx9UscwSDtc2tNnYYe3F4"),   

            #Ids 
            cityIds = sp.nat(0),

            mint_index = sp.nat(0),

            movieID = sp.int(0),

            theatreID = sp.int(0),

            cityDetails = sp.map(l ={},tkey = sp.TNat, tvalue = sp.TRecord(name = sp.TString, theatreIds= sp.TSet(t=sp.TInt))),

            theatreDetails = sp.map(l ={},tkey = sp.TInt, tvalue = sp.TRecord(name = sp.TString,address = sp.TString, movieIds= sp.TSet(t=sp.TInt),theatreOwner=sp.TAddress)),
  
            movieDetails = sp.map(l ={},tkey = sp.TInt, tvalue = sp.TRecord(name = sp.TString, description = sp.TString,posterLink = sp.TString,screenNumber = sp.TNat,ticketPrice=sp.TNat,startingDate = sp.TString,timeSlot=sp.TString,theatreId=sp.TInt)),           

            theatreOwner = sp.map(l ={},tkey = sp.TAddress, tvalue = sp.TInt),

            ticketOwner = sp.map(l ={},tkey = sp.TAddress, tvalue = sp.TSet(t=sp.TString)),
            #Key is seat number and value are details
            #Seats are fixed i.e. 100 so 1st movie 1 to 100, 2nd movie 101 to 200, 3rd....
            seatDetails = sp.map(l={}, tkey=sp.TInt, tvalue=sp.TRecord(ticketOwner=sp.TAddress, booked=sp.TBool,mint_index=sp.TNat,metadata=sp.TBytes,movieId=sp.TInt,seatNumber=sp.TInt))
        )

    

    @sp.entry_point
    def add_city(self,_name):
         
        self.data.cityDetails[self.data.cityIds] = sp.record(name = _name,theatreIds = sp.set())
 
        self.data.cityIds +=1


    @sp.entry_point
    def add_theatre(self,params):
        
        sp.set_type(params, sp.TRecord(_cityId=sp.TNat,_name=sp.TString,_address=sp.TString))

        self.data.theatreDetails[self.data.theatreID] = sp.record(name = params._name,address = params._address, movieIds= sp.set(),theatreOwner = sp.sender)

        self.data.cityDetails[params._cityId].theatreIds.add(self.data.theatreID)

        self.data.theatreOwner[sp.sender] = self.data.theatreID
        
        self.data.theatreID +=1

    @sp.entry_point
    def add_movie(self,params):
        
        sp.set_type(params, sp.TRecord(_theatreId=sp.TInt,_name=sp.TString,_description=sp.TString,_posterLink = sp.TString,_screenNumber = sp.TNat,_ticketPrice = sp.TNat,_startingDate = sp.TString,_timeSlot=sp.TString))

        sp.verify(self.data.theatreDetails[params._theatreId].theatreOwner == sp.sender, message = "Not the owner of the theatre")
        
        self.data.movieDetails[self.data.movieID] = sp.record(name = params._name,description = params._description, posterLink = params._posterLink,screenNumber = params._screenNumber,ticketPrice=params._ticketPrice, startingDate= params._startingDate,timeSlot=params._timeSlot,theatreId=params._theatreId)

        self.data.theatreDetails[params._theatreId].movieIds.add(self.data.movieID)
        
        self.data.movieID +=1

    @sp.entry_point
    def book_ticket(self,params):
        
        sp.set_type(params, sp.TRecord(_movieId=sp.TInt,_seatNumber=sp.TInt,_metadata=sp.TBytes,ticketUrl=sp.TString))

        self.data.seatDetails[(params._movieId)*75+params._seatNumber] = sp.record(ticketOwner = sp.sender,mint_index=self.data.mint_index,booked=True,metadata=params._metadata,movieId=params._movieId,seatNumber=params._seatNumber)

        sp.if self.data.ticketOwner.contains(sp.sender):
            self.data.ticketOwner[sp.sender].add(params.ticketUrl)
        sp.else:
            self.data.ticketOwner[sp.sender] = sp.set([params.ticketUrl], t = sp.TString)

        sp.send(self.data.theatreDetails[self.data.movieDetails[params._movieId].theatreId].theatreOwner, sp.utils.nat_to_mutez(self.data.movieDetails[params._movieId].ticketPrice*1000000)) 

        # Inter-contract call take place here to mint the artwork
        
        c = sp.contract(
            sp.TRecord(
                token_id=sp.TNat,
                amount=sp.TNat,
                address=sp.TAddress,
                metadata=sp.TMap(sp.TString, sp.TBytes),
            ),
            self.data.nft_contract_address,
            "mint",
        ).open_some()

        sp.transfer(
                    sp.record(
                        token_id=self.data.mint_index,
                        amount=1,
                        address=sp.sender,
                        metadata={"": self.data.seatDetails[(params._movieId)*75+params._seatNumber].metadata},
                        # metadata={"": sp.utils.metadata_of_url()},
                    ),
                    sp.utils.nat_to_mutez(0),
                    # sp.utils.nat_to_mutez(self.data.movieDetails[params._movieId].ticketPrice*1000000),
                    c,
                )
        
        self.data.mint_index += 1
        

@sp.add_test(name="main")
def test():
    scenario = sp.test_scenario()

    # Test address
    admin = sp.test_account("admin")
    alice = sp.test_account("alice")
    bob = sp.test_account("bob")
    charles = sp.test_account("charles")

    # Create contract
    auction = TezoTix() 
    scenario += auction

    # change_num_values
    scenario.h2("Auction Test 1")   

    scenario += auction.add_city("Chennai").run(sender = alice)
    scenario += auction.add_theatre(_cityId=0,_name="Ankit",_address="Ankit").run(sender = alice,amount = sp.utils.nat_to_mutez(100000000))
    scenario += auction.add_theatre(_cityId=0,_name="XYZ",_address="Ankit").run(sender = bob,amount = sp.utils.nat_to_mutez(100000000))
    scenario += auction.add_movie(_theatreId=0,_name="Brahmastra",_description="Great Movie",_posterLink = "sdfdsdfsddf",_screenNumber=1,_ticketPrice = 100,_startingDate = "16/08/2023",_timeSlot="9 to 12").run(sender = alice)
    scenario += auction.add_movie(_theatreId=1,_name="John Wick",_description="Great Movie",_posterLink = "sdfdsdfsddf",_screenNumber=1,_ticketPrice = 100,_startingDate = "16/08/2023",_timeSlot="9 to 12").run(sender = bob)
    scenario += auction.add_movie(_theatreId=1,_name="John Wick",_description="Great Movie",_posterLink = "sdfdsdfsddf",_screenNumber=1,_ticketPrice = 100,_startingDate = "16/08/2023",_timeSlot="9 to 12").run(sender = bob)
    scenario += auction.book_ticket(_movieId=0,_seatNumber=10,_metadata=sp.bytes('0x30'),ticketUrl="sdfdsfdfs").run(sender = alice,amount = sp.utils.nat_to_mutez(110000000))
    scenario += auction.book_ticket(_movieId=1,_seatNumber=45,_metadata=sp.bytes('0x30'),ticketUrl="agdfdf").run(sender = bob,amount = sp.utils.nat_to_mutez(110000000))
    scenario += auction.book_ticket(_movieId=2,_seatNumber=45,_metadata=sp.bytes('0x30'),ticketUrl="wejrkewjrk").run(sender = bob,amount = sp.utils.nat_to_mutez(11000000))
