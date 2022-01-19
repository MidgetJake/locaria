import React from 'react';

import {channels, configs} from 'themeLocaria';
import {useStyles} from "stylesLocaria";


import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import {useHistory} from "react-router-dom";
import TextField  from "@mui/material/TextField";
import SearchBanner from "defaults/searchBanner";
import CardImageLoader from "widgets/cardImageLoader";
import { InView } from 'react-intersection-observer';
import { useContext } from 'react';

import LocariaContext from '../context/locariaContext';

const ChannelSearch = () => {

	const myContext = useContext(LocariaContext);

	const classes = useStyles();
	const history = useHistory();

	const [searchResults, setSearchResults] = React.useState([]);
	const [isInView, setIsInView] = React.useState(false);
	const [autoLoad, setAutoLoad] = React.useState(true);

	React.useEffect(() => {

		window.websocket.registerQueue("searchLoader", function (json) {
			setSearchResults(searchResults.concat(json.packet.features));
		});

		if(searchResults.length===0&&myContext.homeSearch!==''&&autoLoad===true) {
			doSearch('new');
		}

		return () => {
			window.websocket.removeQueue("searchLoader");
		}


	}, [searchResults]);

	function handleKeyDown(e) {
		if (e.key === 'Enter') {
			doSearch('new');

		}

	}

	function doSearch(mode='new') {
		setAutoLoad(false);

		const newSearchValue=document.getElementById('mySearch').value;
		myContext.updateHomeSearch(newSearchValue);

		if(mode==='new')
			setSearchResults([]);
		let packet = {
			"queue": "searchLoader",
			"api": "api",
			"data": {
				"method": "search",
				"category": configs.homeCategorySearch,
				"search_text": newSearchValue,
				"limit": configs.searchLimit,
				"offset":searchResults.length
			}
		};
		window.websocket.send(packet);
	}

	const inViewEvent =function(event) {
		console.log(event);
		setIsInView(event);
		if(event===true&&searchResults.length>0) {
			doSearch('scroll');
		}
	}

	const SearchResults = () => {
		if (searchResults.length>0) {
			return (
				searchResults.map(function (feature) {
					return (
						<Grid item md={configs.homeGrid} className={classes.searchResults} key={feature.properties.fid} id={"infini"}>
							<Card className={classes.root}>
								<CardImageLoader defaultImage={configs.defaultImage}
								                 images={feature.properties.description.images}/>
								<CardContent className={classes.channelPanel}>
									<Typography gutterBottom variant="h5" component="h2">
										{feature.properties.description.title}
									</Typography>
									<Typography variant="body2" color="textSecondary" component="p">
										{feature.properties.description.text}
									</Typography>
								</CardContent>
								<CardActions>
									<Button size="small" color="secondary" variant="outlined" onClick={() => {
										let channel = channels.getChannelProperties(feature.properties.category);
										history.push(`/${channel.type}/${feature.properties.category}/${channel.reportId}/${feature.properties.fid}`)
									}}>
										View
									</Button>
								</CardActions>
							</Card>
						</Grid>
					)
				})
			)
		} else {
			return (
				<Grid item md={12 - configs.homeGrid} className={classes.searchResults}>
					<SearchBanner/>
				</Grid>
			)
		}
	}


	const SearchPanel = () => {
		return (
			<Grid item md={configs.homeGrid} className={classes.channel}>
				<Card className={classes.root}>
					<CardMedia
						className={classes.media}
						image={configs.searchIcon}
						title={'Search'}
					/>
					<CardContent className={classes.channelPanel}>
						<Typography gutterBottom variant="h5" component="h2">
							Search
						</Typography>
						<Typography variant="body2" color="textSecondary" component="p">
							Search our records for your connection
						</Typography>
					</CardContent>
					<CardActions>
						<TextField
							placeholder="Search…"
							classes={{
								root: classes.inputRoot,
								input: classes.inputInput,
							}}
							inputProps={{'aria-label': 'search'}}
							defaultValue={myContext.homeSearch}
							onKeyPress={handleKeyDown}
							id="mySearch"
							color="secondary"
						/>

						<Button size="small" color="secondary" variant="outlined" onClick={() => {
							doSearch();
						}}>
							Search
						</Button>
					</CardActions>
				</Card>
			</Grid>
		)
	}

	return (
		<div>
		<Grid container className={classes.root} spacing={2} justifyContent="flex-start">
			<SearchPanel/>
			<SearchResults/>
		</Grid>
			<InView as="div" onChange={(inView, entry) => {inViewEvent(inView)}}>
			</InView>
		</div>
	)
}


export default ChannelSearch;