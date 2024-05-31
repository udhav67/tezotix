import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../utils/AuthProvider";
import { char2Bytes } from "@taquito/tzip16";
import { tezos } from "../utils/tezos";
import { fetchMoviesStorage } from "../utils/tzkt";
import addresses from "../config/config";
import { Web3Storage } from "web3.storage/dist/bundle.esm.min.js";
import locationPin from "../assets/locationPin.svg";
import ticketIcon from "../assets/ticketIcon.svg";
import screenGradient from "../assets/screenGradient.svg";

import HeadingUnderline from "../components/HeadingUnderline";
import TicketCanvas from "../components/TicketCanvas";
import Button from "../components/Button";
import ConnectBtn from "../components/ConnectBtn";

export default function MovieDetail() {
    const { id } = useParams();

    const { address, connected } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [total, setTotal] = useState(0);
    const [ticketUrl, setTicketUrl] = useState(null);

    const [movieDetails, setMovieDetails] = useState(null);
    const [bookedSeats, setBookedSeats] = useState({});
    const [theatreDetail, setTheatreDetail] = useState(null);

    const handlePay = async () => {
        if (loading) {
            return;
        }

        setLoading(true)

        if (!selectedSeats || !selectedSeats.length) {
            toast.error(`Please select a seat!`, {
                position: "top-center",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            setLoading(false)
            return;
        }

        try {
            const contractInstance = await tezos.wallet.at(addresses.movies);

            function getAccessToken() {
                return process.env.REACT_APP_ACCESS_TOKEN;
            }
            function makeStorageClient() {
                return new Web3Storage({ token: getAccessToken() });
            }
            async function makeFileObjects(datauri) {
                var arr = datauri.split(","),
                    mime = arr[0].match(/:(.*?);/)[1],
                    bstr = atob(arr[1]),
                    n = bstr.length,
                    u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return [new File([u8arr], "nftURI.png", { type: mime })];
            }
            async function storeFiles(datauri) {
                const files = await makeFileObjects(datauri);
                const client = makeStorageClient();
                const cid = await client.put(files, { wrapWithDirectory: false });
                return cid;
            }

            const NFTTicketIPFS = await storeFiles(ticketUrl);
            console.log(NFTTicketIPFS);

            const metadata = JSON.stringify({
                name: `${movieDetails?.name}`,
                rights: "All right reserved.",
                symbol: "TZT",
                edition: `1`,
                formats: "[...]",
                creators: "[...]",
                decimals: "0",
                royalties: "{...}",
                attributes: "[...]",
                displayUri: `${NFTTicketIPFS}`,
                artifactUri: `${NFTTicketIPFS}`,
                description: `${movieDetails?.description}`,
                thumbnailUri: `${NFTTicketIPFS}`,
                isBooleanAmount: true,
                shouldPreferSymbol: false,
            });

            async function makeFileObjects1(questions) {
                const files = [new File([questions], "nftInfo.json")];

                return files;
            }

            async function storeFiles1(datauri) {
                const files = await makeFileObjects1(datauri);
                const client = makeStorageClient();
                const cid = await client.put(files, { wrapWithDirectory: false });
                return cid;
            }

            const MetadataCID = await storeFiles1(metadata);

            const metadata_bytes = char2Bytes(`${MetadataCID}`);
            console.log(metadata_bytes);

            const op = await contractInstance.methodsObject
                .book_ticket({
                    _movieId: id,
                    _seatNumber: selectedSeats[0],
                    _metadata: `${metadata_bytes}`,
                    ticketUrl: `${NFTTicketIPFS}`,
                })
                .send({ mutez: true, amount: total * 1000000 });

            await op.confirmation(1);

            setLoading(false)

            toast.success(`Minting NFT was successful`, {
                position: "top-center",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
        } catch (err) {
            setLoading(false)
            toast.error(`An unknown error occured!`, {
                position: "top-center",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            console.log(err);
        }
    };

    const fetchDetails = async () => {
        try {
            const storage = await fetchMoviesStorage();

            const movieDetails = storage.movieDetails;
            const seatDetails = storage.seatDetails;

            console.log(storage);
            setMovieDetails(movieDetails[id]);
            setBookedSeats(seatDetails);
            setTheatreDetail(
                storage.theatreDetails[parseInt(movieDetails[id].theatreId)]
            );
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, []);

    useEffect(() => {
        const p = parseInt(movieDetails?.ticketPrice) * selectedSeats.length;
        setTotal(p + (p * 0.01));
    }, [selectedSeats, movieDetails]);

    return (
        <div className="flex flex-col flex-1">
            {connected ? (
                <>
                    <div className="flex max-w-[1450px] mx-auto">
                        <div className="flex-1 px-30 relative">
                            <img
                                src={movieDetails?.posterLink}
                                alt={movieDetails?.name}
                                className="w-full rounded-20 border-primary border-[2px]"
                            />
                        </div>
                        <div className="flex-1 px-30 flex flex-col justify-center gap-10">
                            <div className="flex flex-col gap-8">
                                <h1 className="text-4xl font-bold text-white">
                                    {movieDetails?.name}
                                </h1>
                                <p className="text-base text-white/50">
                                    {movieDetails?.description}
                                </p>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-row gap-2">
                                    <img src={locationPin} className="w-5" />
                                    <p className="text-xl font-medium text-white/75">
                                        {theatreDetail?.name}, {theatreDetail?.address}
                                    </p>
                                </div>
                                <div className="flex flex-row gap-2 items-center">
                                    <img src={ticketIcon} className="w-5" />
                                    <p className="text-xl font-medium text-white/75">
                                        {movieDetails?.timeSlot}, {movieDetails?.startingDate}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center flex-wrap gap-[100px] px-20 mt-50">
                        <div className="w-[calc(50%-70px)] flex flex-col gap-14">
                            <div className="flex items-center gap-4">
                                <p className="flex justify-center items-center w-[40px] h-[40px] rounded-full border-primary bg-blackToTrans text-xl font-medium">
                                    2
                                </p>
                                <HeadingUnderline>Select your seats</HeadingUnderline>
                            </div>

                            <div className="flex flex-col justify-center gap-5 w-full">
                                <img src={screenGradient} alt="" />

                                <div className="flex flex-col gap-[10px]">
                                    {Array(5)
                                        .fill()
                                        .map((_1, ind1) => {
                                            return (
                                                <div className="flex flex-row gap-[10px] justify-center">
                                                    {Array(9)
                                                        .fill()
                                                        .map((_2, ind2) => {
                                                            return (
                                                                <div
                                                                    aria-label={(
                                                                        parseInt(id) * 45 +
                                                                        ind1 * 10 +
                                                                        ind2
                                                                    ).toString()}
                                                                    className={`w-7 h-7 rounded-t-[8px] ${bookedSeats[
                                                                        (
                                                                            parseInt(id) * 45 +
                                                                            ind1 * 10 +
                                                                            ind2
                                                                        ).toString()
                                                                    ]
                                                                        ? "bg-yellow"
                                                                        : " cursor-pointer"
                                                                        } ${selectedSeats.includes(
                                                                            (
                                                                                parseInt(id) * 45 +
                                                                                ind1 * 10 +
                                                                                ind2
                                                                            ).toString()
                                                                        )
                                                                            ? "bg-green"
                                                                            : "bg-white/10"
                                                                        }`}
                                                                    onClick={() => {
                                                                        if (
                                                                            !bookedSeats[
                                                                            (
                                                                                parseInt(id) * 45 +
                                                                                ind1 * 10 +
                                                                                ind2
                                                                            ).toString()
                                                                            ]
                                                                        ) {
                                                                            if (
                                                                                selectedSeats.includes(
                                                                                    (
                                                                                        parseInt(id) * 45 +
                                                                                        ind1 * 10 +
                                                                                        ind2
                                                                                    ).toString()
                                                                                )
                                                                            ) {
                                                                                setSelectedSeats([]);
                                                                            } else {
                                                                                setSelectedSeats([
                                                                                    (
                                                                                        parseInt(id) * 45 +
                                                                                        ind1 * 10 +
                                                                                        ind2
                                                                                    ).toString(),
                                                                                ]);
                                                                            }
                                                                        }
                                                                    }}
                                                                ></div>
                                                            );
                                                        })}
                                                </div>
                                            );
                                        })}
                                </div>

                                <div className="flex gap-10 justify-center">
                                    <div className="flex items-center gap-2">
                                        <p className="w-4 h-4 rounded-full bg-yellow"></p>
                                        <p>Booked</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="w-4 h-4 rounded-full bg-green"></p>
                                        <p>Selected</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="w-4 h-4 rounded-full bg-white/10"></p>
                                        <p>Available</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-[calc(50%-70px)] flex flex-col gap-14">
                            <div className="flex items-center gap-4">
                                <p className="flex justify-center items-center w-[40px] h-[40px] rounded-full border-primary bg-blackToTrans text-xl font-medium">
                                    3
                                </p>
                                <HeadingUnderline>Booking summary</HeadingUnderline>
                            </div>

                            <div className="flex justify-between items-center gap-[70px]">
                                {movieDetails ? (
                                    <TicketCanvas
                                        ticketDetails={{
                                            poster: movieDetails.posterLink,
                                            name: movieDetails.name,
                                            dateTime:
                                                movieDetails.timeSlot +
                                                ", " +
                                                movieDetails.startingDate,
                                            theatre: theatreDetail?.address,
                                            screenNo: movieDetails.screenNumber,
                                            seats: selectedSeats,
                                            price:
                                                parseInt(movieDetails?.ticketPrice) *
                                                selectedSeats.length,
                                            barcodeData: address,
                                        }}
                                        setTicketUrl={setTicketUrl}
                                        height="350px"
                                    />
                                ) : null}

                                <div className="w-full h-max flex flex-col gap-5">
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins">Theatre name:</p>
                                        <p className="text-white Poppins font-medium">
                                            {theatreDetail?.name}
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            Show Date:
                                        </p>
                                        <p className="text-white Poppins font-medium">
                                            {movieDetails?.startingDate}
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            Show timing:
                                        </p>
                                        <p className="text-white Poppins font-medium">
                                            {movieDetails?.timeSlot}
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            Number of selected seats:
                                        </p>
                                        <p className="text-white Poppins font-medium">
                                            {selectedSeats.length}
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            Price per seat:
                                        </p>
                                        <p className="text-white Poppins font-medium">
                                            {movieDetails?.ticketPrice} ꜩ
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            TezoTix Booking fees:
                                        </p>
                                        <p className="text-white/80 Poppins font-medium">
                                            1% of total
                                        </p>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="text-white/50 Poppins font-medium">
                                            Subtotal:
                                        </p>
                                        <p className="text-white Poppins font-medium">
                                            {total}{" "}
                                            ꜩ
                                        </p>
                                    </div>

                                    <Button weight={"700"} onClick={handlePay}>
                                        {
                                            loading
                                                ? "Loading..."
                                                : <>
                                                    Pay{" "}
                                                    {total}{" "}
                                                    ꜩ
                                                </>
                                        }
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="w-screen flex-1 flex flex-col justify-center items-center gap-14">
                    <div className="flex flex-col justify-center items-center gap-3">
                        <h2 className="text-5xl font-semibold">Oops!</h2>
                        <p className="text-lg font-medium text-center">
                            Looks like you're not connected to your wallet!
                        </p>
                    </div>
                    <ConnectBtn />
                </div>
            )}
        </div>
    );
}
